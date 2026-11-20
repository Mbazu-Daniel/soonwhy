import { describe, expect, it } from "vitest";
import { applySpanAttributePolicy } from "./attribute-policy";
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
