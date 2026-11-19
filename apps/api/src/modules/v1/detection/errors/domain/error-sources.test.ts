import { describe, expect, it } from "vitest";
import { mergeErrorSources } from "./error-sources";

const span = (extra: Record<string, unknown>) => ({
  timestamp: "2026-11-14T10:00:00.000Z",
  service: "api",
  name: "GET /x",
  statusCode: 2,
  ...extra,
});

describe("mergeErrorSources", () => {
  it("keeps error spans from different traces that share a span id", () => {
    const result = mergeErrorSources({
      logs: [],
      requests: [],
      spans: [span({ traceId: "t1", spanId: "s1" }), span({ traceId: "t2", spanId: "s1" })] as never,
    });
    expect(result.map((item) => item.traceId).sort()).toEqual(["t1", "t2"]);
  });

  it("lets a failed request replace the span with the same trace and span id", () => {
    const result = mergeErrorSources({
      logs: [],
      spans: [span({ traceId: "t1", spanId: "s1" })] as never,
      requests: [{ traceId: "t1", spanId: "s1", method: "GET", route: "/x", statusCode: 500, service: "api", timestamp: "2026-11-14T10:00:01.000Z" }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.message).toContain("500");
  });

  it("treats a span with only an error.type as a plain span, so an error log in the trace wins", () => {
    const result = mergeErrorSources({
      logs: [{ id: "l1", timestamp: "2026-11-14T10:00:00.000Z", service: "api", level: "error", message: "timeout talking to db", traceId: "t1" }] as never,
      spans: [span({ traceId: "t1", spanId: "s1", errorType: "timeout", statusMessage: "db timed out" })] as never,
      requests: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.message).toBe("timeout talking to db");
  });

  it("uses the status message of a plain failed span", () => {
    const result = mergeErrorSources({
      logs: [],
      requests: [],
      spans: [span({ traceId: "t1", spanId: "s1", errorType: "timeout", statusMessage: "db timed out" })] as never,
    });
    expect(result[0]!.message).toBe("db timed out");
  });

  it("drops a failed request that an error log with the same status already covers, even with no trace ids", () => {
    const result = mergeErrorSources({
      logs: [{ id: "l1", timestamp: "2026-11-14T10:00:00.500Z", service: "api", level: "error", message: "boom", attributes: { "http.status_code": 500 } }] as never,
      spans: [],
      requests: [{ id: "r1", method: "GET", route: "/x", statusCode: 500, service: "api", timestamp: "2026-11-14T10:00:01.000Z" }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.message).toBe("boom");
  });

  it("keeps a failed request when the log is another status, service or far in time", () => {
    const log = { id: "l1", timestamp: "2026-11-14T10:00:00.000Z", service: "api", level: "error", message: "boom", attributes: { "http.status_code": 500 } };
    const request = { method: "GET", route: "/x", statusCode: 500, service: "api", timestamp: "2026-11-14T10:00:01.000Z" };
    const kept = (overrides: Record<string, unknown>) =>
      mergeErrorSources({ logs: [log] as never, spans: [], requests: [{ ...request, ...overrides }] }).length;
    expect(kept({ statusCode: 502 })).toBe(2);
    expect(kept({ service: "worker" })).toBe(2);
    expect(kept({ timestamp: "2026-11-14T10:00:30.000Z" })).toBe(2);
  });
});
