import { decryptPii } from "@soonwhy/shared";
import { describe, expect, it } from "vitest";
import { applyMetricAttributePolicy, applySpanAttributePolicy } from "./attribute-policy";
import { METRIC_ATTRIBUTE_LIMITS } from "./attribute-policy.constants";
import { describePayload } from "./payload-shape";

const SHARED_SHAPE = {
  type: "object",
  fields: {
    a: { type: "number" },
    b: { type: "object", fields: { c: { type: "array", length: 2, items: { type: "string" } }, d: { type: "null" } } },
    e: { type: "array", length: 1, items: { type: "object", fields: { f: { type: "boolean" } } } },
    g: { type: "array", length: 0, items: null },
  },
};

const SETTINGS = {
  redactSensitiveData: true,
  captureRequestHeaders: true,
  captureRequestBody: true,
  captureResponseBody: true,
  maxAttributeCount: 100,
  maxAttributeValueLength: 4096,
};

describe("applySpanAttributePolicy", () => {
  const out = applySpanAttributePolicy(
    {
      "db.statement": "SELECT * FROM users WHERE email = 'jane@example.com' AND id = 42",
      "db.query.text": "UPDATE t SET note = 'private note' WHERE id = 7",
      "http.request.body": '{"password":"hunter2"}',
      "http.response.body": '{"ok":true}',
      "http.route": "/orders",
      missing: undefined,
    },
    SETTINGS,
  );

  it("keeps no literal from any attribute that can carry one", () => {
    const stored = JSON.stringify(out);
    for (const value of ["jane@example.com", "private note", "hunter2", "42", "= 7"]) expect(stored).not.toContain(value);
  });

  it("keeps ordinary attributes and drops undefined ones", () => {
    expect(out["http.route"]).toBe("/orders");
    expect(out).not.toHaveProperty("missing");
  });
});

describe("body shape rules", () => {
  it("match the SDK's, which asserts the same shape for the same body", () => {
    const body = JSON.stringify({ a: 1, b: { c: ["x", "y"], d: null }, e: [{ f: true }], g: [] });
    expect(describePayload(body).shape).toEqual(SHARED_SHAPE);
  });
});

describe("applyMetricAttributePolicy", () => {
  it("drops keys that look like secrets", () => {
    const out = applyMetricAttributePolicy({ "user.token": "secret-token-value", "http.authorization": "Bearer abc", "http.route": "/orders" });
    expect(out).not.toHaveProperty("user.token");
    expect(out).not.toHaveProperty("http.authorization");
    expect(JSON.stringify(out)).not.toContain("secret-token-value");
    expect(out["http.route"]).toBe("/orders");
  });

  it("never stores a PII value in clear text", () => {
    const out = applyMetricAttributePolicy({
      "customer.email": "customer@example.com",
      note: "contact jane@example.com about it",
      card: "4111 1111 1111 1111",
    });
    const stored = JSON.stringify(out);
    for (const value of ["customer@example.com", "jane@example.com", "4111 1111 1111 1111"]) expect(stored).not.toContain(value);
  });

  it("redacts secret-like text inside ordinary values", () => {
    const out = applyMetricAttributePolicy({ "http.target": "/cb?api_key=abc123def456&page=2" });
    expect(out["http.target"]).not.toContain("abc123def456");
  });

  it("keeps ordinary labels unchanged and stringifies non-string values", () => {
    const out = applyMetricAttributePolicy({ state: "used", direction: "receive", "http.response.status_code": 200, cached: true, ratio: 0.5 });
    expect(out).toEqual({ state: "used", direction: "receive", "http.response.status_code": "200", cached: "true", ratio: "0.5" });
  });

  it("stringifies and sanitises nested values", () => {
    const out = applyMetricAttributePolicy({ context: { owner: "owner@example.com", region: "eu" } });
    expect(typeof out.context).toBe("string");
    expect(out.context).not.toContain("owner@example.com");
    expect(out.context).toContain("eu");
  });

  it("truncates values to the metric limit instead of rejecting them", () => {
    const out = applyMetricAttributePolicy({ long: "x".repeat(1000) });
    expect(out.long).toHaveLength(METRIC_ATTRIBUTE_LIMITS.maxAttributeValueLength);
  });

  it("truncates array values as a whole, not item by item", () => {
    const out = applyMetricAttributePolicy({ list: Array.from({ length: 10 }, () => "y".repeat(100)) });
    expect(out.list).toHaveLength(METRIC_ATTRIBUTE_LIMITS.maxAttributeValueLength);
  });

  it("encrypts a long PII value whole and never truncates it", () => {
    const email = `${"a".repeat(5000)}@example.com`;
    const out = applyMetricAttributePolicy({ owner: email });
    const owner = out.owner ?? "";
    expect(owner).not.toContain("example.com");
    expect(decryptPii(owner)).toBe(email);
  });

  it("encrypts a long value under a PII key whole and never truncates it", () => {
    const phone = "0".repeat(600);
    const out = applyMetricAttributePolicy({ "customer.phone": phone });
    expect(decryptPii(out["customer.phone"] ?? "")).toBe(phone);
  });

  it("protects a filter label whose value looks like PII instead of exempting it", () => {
    const out = applyMetricAttributePolicy({ state: "4111111111111111", direction: "receive" });
    expect(out).toHaveProperty("state");
    expect(out.state).not.toContain("4111111111111111");
    expect(out.direction).toBe("receive");
  });

  it("keeps at most the metric attribute count and always keeps the filter labels", () => {
    const attributes: Record<string, string> = {};
    for (let i = 0; i < 80; i += 1) attributes[`label.${String(i).padStart(2, "0")}`] = "v";
    attributes.state = "used";
    attributes.direction = "transmit";
    attributes["db.client.connection.pool.name"] = "primary";
    attributes["db.client.connection.state"] = "idle";
    const out = applyMetricAttributePolicy(attributes);
    expect(Object.keys(out)).toHaveLength(METRIC_ATTRIBUTE_LIMITS.maxAttributeCount);
    expect(out.state).toBe("used");
    expect(out.direction).toBe("transmit");
    expect(out["db.client.connection.pool.name"]).toBe("primary");
    expect(out["db.client.connection.state"]).toBe("idle");
  });

  it("does not let dropped sensitive keys use up the attribute budget", () => {
    const attributes: Record<string, string> = {};
    for (let i = 0; i < 60; i += 1) attributes[`password.${i}`] = "p";
    attributes.state = "used";
    const out = applyMetricAttributePolicy(attributes);
    expect(out).toEqual({ state: "used" });
  });
});
