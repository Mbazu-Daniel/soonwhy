import { describe, expect, it, vi } from "vitest";
import { expressErrorHandler, fastifyErrorHook } from "./http-errors.js";

function target() {
  return { captureError: vi.fn() };
}

describe("expressErrorHandler", () => {
  it("captures a server error with its route template and passes it on", () => {
    const sdk = target();
    const next = vi.fn();
    const error = new Error("boom");
    expressErrorHandler(sdk)(error, { method: "POST", route: { path: "/orders/:id" } }, {}, next);
    expect(sdk.captureError).toHaveBeenCalledWith({
      error,
      attributes: { "exception.mechanism": "express.error_handler", "http.request.method": "POST", "http.route": "/orders/:id", "http.status_code": 500 },
    });
    expect(next).toHaveBeenCalledWith(error);
  });

  it("ignores client errors but still forwards them", () => {
    const sdk = target();
    const next = vi.fn();
    const error = Object.assign(new Error("nope"), { status: 404 });
    expressErrorHandler(sdk)(error, {}, {}, next);
    expect(sdk.captureError).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });

  it("never breaks the request when capture itself throws", () => {
    const sdk = { captureError: vi.fn(() => { throw new Error("sdk down"); }) };
    const next = vi.fn();
    expect(() => expressErrorHandler(sdk)(new Error("x"), {}, {}, next)).not.toThrow();
    expect(next).toHaveBeenCalled();
  });
});

describe("fastifyErrorHook", () => {
  it("captures with the fastify route and uses statusCode", () => {
    const sdk = target();
    const done = vi.fn();
    const error = Object.assign(new Error("db"), { statusCode: 503 });
    fastifyErrorHook(sdk)({ method: "GET", routeOptions: { url: "/health" } }, {}, error, done);
    expect(sdk.captureError.mock.calls[0]?.[0].attributes).toMatchObject({ "http.route": "/health", "http.status_code": 503 });
    expect(done).toHaveBeenCalled();
  });
});
