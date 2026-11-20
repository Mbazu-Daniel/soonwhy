import { describe, expect, it } from "vitest";
import { findSensitiveExposures } from "./sensitive-exposure";

const body = (fields: Record<string, string>) =>
  JSON.stringify({ bytes: 100, format: "json", shape: { type: "object", fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { type: v }])) } });
const span = (id: string, route: string, response: string, request?: string) => ({
  spanId: id, service: "api", route, attributes: { "http.response.body": response, ...(request ? { "http.request.body": request } : {}) },
});

describe("findSensitiveExposures", () => {
  it("groups the same leaked field on the same route and counts it", () => {
    const leaked = body({ id: "number", passwordHash: "string" });
    const result = findSensitiveExposures([span("a", "/users/:id", leaked), span("b", "/users/:id", leaked)]);
    expect(result).toEqual([{ service: "api", route: "/users/:id", path: "passwordHash", severity: "critical", count: 2, spanIds: ["a", "b"] }]);
  });

  it("treats a token as a warning, not critical", () => {
    expect(findSensitiveExposures([span("a", "/login", body({ accessToken: "string" }))])[0]?.severity).toBe("warning");
  });

  it("ignores sensitive fields that only appear in the request", () => {
    expect(findSensitiveExposures([span("a", "/login", body({ ok: "boolean" }), body({ password: "string" }))])).toEqual([]);
  });

  it("ignores spans without a stored body", () => {
    expect(findSensitiveExposures([{ spanId: "a", service: "api", route: "/", attributes: {} }])).toEqual([]);
  });
});
