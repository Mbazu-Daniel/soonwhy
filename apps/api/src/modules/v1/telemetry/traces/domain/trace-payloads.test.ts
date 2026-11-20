import { describe, expect, it } from "vitest";
import { analyzeTracePayloads } from "./trace-payloads";

const stored = (bytes: number, shape: unknown) => JSON.stringify({ bytes, format: "json", shape });
const span = (attributes: Record<string, unknown>) => ({ spanId: "s1", name: "POST /login", attributes });
const obj = (fields: Record<string, unknown>) => ({ type: "object", fields });

describe("analyzeTracePayloads", () => {
  it("ignores spans with no captured body or an unreadable one", () => {
    expect(analyzeTracePayloads([span({}), span({ "http.request.body": "not json" })])).toEqual([]);
  });

  it("reports a clean body with its size and field count", () => {
    const [report] = analyzeTracePayloads([span({ "http.response.body": stored(120, obj({ id: { type: "number" }, name: { type: "string" } })) })]);
    expect(report).toMatchObject({ side: "response", bytes: 120, fieldCount: 2, issues: [] });
  });

  it("flags sensitive fields by their path and tells request from response apart", () => {
    const shape = obj({ user: obj({ password: { type: "string" } }), apiKey: { type: "string" } });
    const reports = analyzeTracePayloads([span({ "http.request.body": stored(50, shape), "http.response.body": stored(50, shape) })]);
    const messages = reports.flatMap((r) => r.issues).map((i) => `${i.side}:${i.path}`);
    expect(messages.sort()).toEqual(["request:apiKey", "request:user.password", "response:apiKey", "response:user.password"]);
    expect(reports.find((r) => r.side === "response")!.issues[0]!.message).toContain("Do not return it");
  });

  it("flags large bodies and unbounded lists", () => {
    const shape = obj({ items: { type: "array", length: 500, items: obj({ id: { type: "number" } }) } });
    const [report] = analyzeTracePayloads([span({ "http.response.body": stored(250_000, shape) })]);
    expect(report!.issues.map((i) => i.kind)).toEqual(["large", "unbounded_list"]);
    expect(report!.issues[1]!.path).toBe("items");
  });

  it("flags deep nesting", () => {
    let shape: unknown = { type: "string" };
    for (let i = 0; i < 7; i += 1) shape = obj({ a: shape });
    const [report] = analyzeTracePayloads([span({ "http.response.body": stored(80, shape) })]);
    expect(report!.issues.map((i) => i.kind)).toContain("deep_nesting");
  });

  it("lists the bodies with the most issues first", () => {
    const risky = stored(10, obj({ token: { type: "string" } }));
    const fine = stored(9999, obj({ id: { type: "number" } }));
    const reports = analyzeTracePayloads([{ spanId: "a", name: "fine", attributes: { "http.response.body": fine } }, { spanId: "b", name: "risky", attributes: { "http.response.body": risky } }]);
    expect(reports.map((r) => r.spanId)).toEqual(["b", "a"]);
  });
});
