import { trace } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";
import { initNode, shutdown } from "./client.js";

type LogRecord = { traceId?: string; spanId?: string; body?: { stringValue?: string } };

function loggedRecords(fetch: ReturnType<typeof vi.fn<typeof globalThis.fetch>>): LogRecord[] {
  const call = fetch.mock.calls.find(([url]) => String(url).endsWith("/logs"));
  const body = JSON.parse(String(call?.[1]?.body));
  return body.resourceLogs[0].scopeLogs[0].logRecords;
}

describe("trace correlation", () => {
  it("links captured errors and logs to the active span, and keeps explicit ids", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("{}", { status: 200 }));
    const client = initNode({
      apiKey: "sk_test_trace",
      endpoint: "http://127.0.0.1:9/v1",
      serviceName: "trace-example",
      flushIntervalMs: 0,
      timeoutMs: 300,
      fetch,
      sleep: async () => undefined,
      registerShutdownHandlers: false,
      captureUncaughtErrors: false,
      instrumentations: { http: false, express: false, nestjs: false, postgres: false, redis: false, ioredis: false },
    });

    const explicit = "a".repeat(32);
    let expected = { traceId: "", spanId: "" };
    trace.getTracer("test").startActiveSpan("request", (span) => {
      expected = { traceId: span.spanContext().traceId, spanId: span.spanContext().spanId };
      client.captureError({ error: new Error("in-span") });
      client.captureLog({ message: "log-in-span" });
      client.captureLog({ message: "explicit", traceId: explicit });
      span.end();
    });
    client.captureError({ error: new Error("outside") });
    await client.flush();

    const byMessage = new Map(loggedRecords(fetch).map((record) => [record.body?.stringValue, record]));
    expect(expected.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(expected.traceId).not.toBe("0".repeat(32));
    expect(byMessage.get("in-span")).toMatchObject(expected);
    expect(byMessage.get("log-in-span")).toMatchObject(expected);
    expect(byMessage.get("explicit")?.traceId).toBe(explicit);
    expect(byMessage.get("outside")?.traceId).toBeUndefined();
    await shutdown().catch(() => undefined);
  }, 30_000);
});
