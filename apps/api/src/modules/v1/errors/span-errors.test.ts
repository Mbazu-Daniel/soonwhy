import { describe, expect, it } from "vitest";
import { isErrorSpan, spanToErrorSource } from "./span-errors";
import { errorTypeOf } from "./error-fingerprint";

const base = { spanId: "s1", traceId: "t1", service: "api", timestamp: "2026-11-14T10:00:00.000Z", name: "GET /users/:id" };

describe("HTTP failures on server spans", () => {
  it("counts a 404 span even though its status is unset", () => {
    expect(isErrorSpan({ ...base, statusCode: 0, httpStatusCode: 404 })).toBe(true);
    expect(isErrorSpan({ ...base, statusCode: 0, httpStatusCode: 200 })).toBe(false);
  });

  it("builds the same request-style message and warn level for a 404", () => {
    const source = spanToErrorSource({ ...base, statusCode: 0, httpStatusCode: 404, attributes: { "http.request.method": "GET", "http.route": "/users/:id" } });
    expect(source).toMatchObject({ level: "warn", message: "GET /users/:id 404", traceId: "t1" });
    expect(source.attributes).toMatchObject({ "http.status_code": "404" });
  });

  it("marks a 500 as an error", () => {
    expect(spanToErrorSource({ ...base, statusCode: 2, httpStatusCode: 500 }).level).toBe("error");
  });

  it("groups a span 404 under the same type the request path used", () => {
    const source = spanToErrorSource({ ...base, statusCode: 0, httpStatusCode: 404, attributes: { "http.method": "GET" } });
    expect(errorTypeOf(source)).toBe("HTTP 404");
  });
});
