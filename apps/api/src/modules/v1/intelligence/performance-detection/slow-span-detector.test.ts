import { describe, expect, it } from "vitest";
import { detectSlowSpans } from "./slow-span-detector";

describe("detectSlowSpans", () => {
  it("flags spans at or above the threshold and preserves trace metadata", () => {
    const findings = detectSlowSpans(
      [
        { spanName: "db.query", durationMs: 600, traceId: "trace-1", timestamp: "2026-05-01T00:00:00.000Z" },
        { spanName: "http.call", durationMs: 1200, traceId: "trace-1", parentSpanId: "span-1", timestamp: "2026-05-01T00:00:01.000Z" },
      ],
      500,
    );

    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      spanName: "db.query",
      metric: "span_duration",
      severity: "warning",
      traceId: "trace-1",
    });
    expect(findings[1]).toMatchObject({ severity: "critical", parentSpanId: "span-1" });
  });

  it("ignores spans under the threshold", () => {
    expect(
      detectSlowSpans([{ spanName: "fast", durationMs: 499, timestamp: "2026-05-01T00:00:00.000Z" }], 500),
    ).toEqual([]);
  });
});
