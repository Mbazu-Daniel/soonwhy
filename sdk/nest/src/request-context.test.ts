import { HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { requestContext } from "./request-context.js";

function host(type: string, request: unknown) {
  return {
    getType: () => type,
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe("requestContext", () => {
  it("reads the express route template and never the url", () => {
    const context = requestContext(new Error("x"), host("http", { method: "POST", route: { path: "/orders/:id" }, url: "/orders/42?token=secret" }));
    expect(context).toEqual({ "http.request.method": "POST", "http.route": "/orders/:id", "http.status_code": 500 });
  });

  it("reads the fastify route and the status of an http exception", () => {
    const context = requestContext(new HttpException("bad", 503), host("http", { method: "GET", routeOptions: { url: "/health" } }));
    expect(context).toMatchObject({ "http.route": "/health", "http.status_code": 503 });
  });

  it("adds nothing for non-http contexts", () => {
    expect(requestContext(new Error("x"), host("rpc", {}))).toEqual({});
  });
});
