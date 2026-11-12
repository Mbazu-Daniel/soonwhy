import { describe, expect, it, afterAll } from "vitest";
import { initNode } from "@soonwhy/node";
import { createSoonwhyInstrumentation } from "./instrumentation.js";

const options = {
  apiKey: "soonwhy-next-test-key",
  serviceName: "soonwhy-next-test",
  environment: "test",
  endpoint: "http://localhost:9/v1",
  maxRetries: 0,
  flushIntervalMs: 0,
  registerShutdownHandlers: false,
} as const;

const client = initNode({ ...options });

afterAll(async () => {
  await client.shutdown();
});

describe("createSoonwhyInstrumentation", () => {
  it("register() initializes the Node SDK", () => {
    const instrumentation = createSoonwhyInstrumentation({ ...options });

    expect(() => instrumentation.register()).not.toThrow();
    expect(client.isStarted()).toBe(true);
  });

  it("captures request errors into the SDK log pipeline", () => {
    const instrumentation = createSoonwhyInstrumentation({ ...options });
    const queuedBefore = client.getStats().queued;

    instrumentation.onRequestError(
      new Error("render exploded"),
      { path: "/boom", method: "GET" },
      { routePath: "/boom", routeType: "route", routerKind: "App Router" },
    );

    expect(client.getStats().queued).toBe(queuedBefore + 1);
  });

  it("never throws, even for opaque errors", () => {
    const instrumentation = createSoonwhyInstrumentation({ ...options });
    expect(() =>
      instrumentation.onRequestError("string failure", {}),
    ).not.toThrow();
  });
});
