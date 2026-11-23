import { describe, expect, it } from "vitest";
import { measureTraceIntegrity, traceIntegrityLimitation } from "./root-cause.trace-integrity";
import type { TraceSpan } from "./root-cause.ranker.types";

const span = (spanId: string, parentSpanId: string | undefined, startTime: number, duration: number): TraceSpan => ({
  traceId: "t",
  spanId,
  parentSpanId,
  serviceName: "s",
  startTime,
  duration,
});

const cleanTrace = [span("a", undefined, 0, 100), span("b", "a", 10, 50), span("c", "b", 20, 20)];

describe("trace integrity", () => {
  it("finds nothing wrong in nested, fully parented traces", () => {
    expect(measureTraceIntegrity([cleanTrace])).toEqual({ orphanRatio: 0, escapedRatio: 0 });
    expect(traceIntegrityLimitation([cleanTrace])).toBeUndefined();
  });

  it("counts children whose parent is not in the trace", () => {
    const trace = [span("a", undefined, 0, 100), span("b", "gone", 10, 50), span("c", "a", 20, 20), span("d", "gone2", 30, 5)];
    expect(measureTraceIntegrity([trace]).orphanRatio).toBeCloseTo(2 / 3);
  });

  it("counts children that start before or end after their parent beyond the tolerance", () => {
    const trace = [span("a", undefined, 1000, 100), span("b", "a", 700, 50), span("c", "a", 1010, 50)];
    expect(measureTraceIntegrity([trace]).escapedRatio).toBeCloseTo(1 / 2);
  });

  it("tolerates small skew inside the tolerance", () => {
    const trace = [span("a", undefined, 1000, 100), span("b", "a", 950, 50)];
    expect(measureTraceIntegrity([trace]).escapedRatio).toBe(0);
  });

  it("reports a limitation when parentage is mostly lost", () => {
    const trace = [span("a", undefined, 0, 100), span("b", "x", 10, 5), span("c", "y", 10, 5), span("d", "a", 10, 5)];
    expect(traceIntegrityLimitation([trace])).toMatch(/parent/i);
  });

  it("reports a limitation when timestamps disagree across services", () => {
    const trace = [span("a", undefined, 1000, 100), span("b", "a", 100, 50), span("c", "a", 1900, 50), span("d", "a", 1010, 20)];
    expect(traceIntegrityLimitation([trace])).toMatch(/timestamps|clock/i);
  });

  it("has nothing to say about no traces", () => {
    expect(measureTraceIntegrity([])).toEqual({ orphanRatio: 0, escapedRatio: 0 });
    expect(traceIntegrityLimitation([])).toBeUndefined();
  });
});
