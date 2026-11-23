import { describe, expect, it } from "vitest";
import { correctClockSkew } from "./root-cause.clock-skew";
import { measureTraceIntegrity } from "./root-cause.trace-integrity";
import type { TraceSpan } from "./root-cause.ranker.types";

const span = (spanId: string, serviceName: string, parentSpanId: string | undefined, startTime: number, duration: number): TraceSpan => ({
  traceId: "t", spanId, serviceName, parentSpanId, startTime, duration,
});

const shifted = (offsets: Record<string, number>, trace: TraceSpan[]) =>
  trace.map((s) => ({ ...s, startTime: s.startTime + (offsets[s.serviceName] ?? 0) }));

const truth = (n: number): TraceSpan[] => [
  span(`g${n}`, "gateway", undefined, n * 1000, 400),
  span(`o${n}`, "orders", `g${n}`, n * 1000 + 20, 300),
  span(`d${n}`, "db", `o${n}`, n * 1000 + 60, 200),
];

describe("clock skew correction", () => {
  const traces = [1, 2, 3, 4, 5].map(truth);

  it("leaves consistent traces untouched", () => {
    const result = correctClockSkew(traces);
    expect(result.traces).toBe(traces);
    expect(result.offsets.size).toBe(0);
  });

  it("recovers each service's offset relative to the root service within a small error", () => {
    const skewed = traces.map((t) => shifted({ orders: 450, db: -380 }, t));
    const { offsets } = correctClockSkew(skewed);
    expect(offsets.get("gateway")).toBe(0);
    expect(Math.abs(offsets.get("orders")! - 450)).toBeLessThan(80);
    expect(Math.abs(offsets.get("db")! - -380)).toBeLessThan(120);
  });

  it("makes skewed traces nest again", () => {
    const skewed = traces.map((t) => shifted({ orders: 450, db: -380 }, t));
    expect(measureTraceIntegrity(skewed).escapedRatio).toBeGreaterThan(0.25);
    expect(measureTraceIntegrity(correctClockSkew(skewed).traces).escapedRatio).toBeLessThan(0.1);
  });

  it("does not change durations or span identities", () => {
    const skewed = traces.map((t) => shifted({ orders: 450 }, t));
    const corrected = correctClockSkew(skewed).traces;
    expect(corrected.flat().map((s) => [s.spanId, s.duration])).toEqual(skewed.flat().map((s) => [s.spanId, s.duration]));
  });

  it("leaves a service it cannot connect to the root unshifted", () => {
    const skewed = [...traces.map((t) => shifted({ orders: 450 }, t)), [span("x", "island", "missing", 5, 5)]];
    expect(correctClockSkew(skewed).offsets.has("island")).toBe(false);
  });

  it("keeps every span nested when different traces bound the same offset differently", () => {
    const t1 = [span("a1", "A", undefined, 0, 1000), span("c1", "C", "a1", 0, 10)];
    const t2 = [span("a2", "A", undefined, 2000, 10), span("c2", "C", "a2", 2000, 10), span("b2", "B", "a2", 2500, 10)];
    const { traces, offsets } = correctClockSkew([t1, t2]);

    expect(offsets.get("C")).toBeCloseTo(0);
    expect(offsets.get("B")).toBeCloseTo(500);
    expect(measureTraceIntegrity(traces).escapedRatio).toBe(0);
  });

  it("corrects every separate group of services, not only the one holding the most common root", () => {
    const lone = [1, 2, 3].map((n) => [span(`a${n}`, "A", undefined, n * 1000, 100)]);
    const pair = [1, 2].map((n) => [span(`e${n}`, "E", undefined, n * 1000, 400), span(`f${n}`, "F", `e${n}`, n * 1000 + 20 + 500, 300)]);
    const { offsets, traces } = correctClockSkew([...lone, ...pair]);

    expect(offsets.get("E")).toBe(0);
    expect(Math.abs(offsets.get("F")! - 500)).toBeLessThan(80);
    expect(measureTraceIntegrity(traces).escapedRatio).toBeLessThan(0.1);
  });
});
