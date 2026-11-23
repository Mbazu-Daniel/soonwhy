import { describe, expect, it } from "vitest";
import { RootCauseRanker } from "./root-cause.ranker";
import type { TraceSpan } from "./root-cause.ranker.types";

const ranker = new RootCauseRanker();

const span = (spanId: string, serviceName: string, parentSpanId?: string, isError = false, startTime = 0, traceId = "t1"): TraceSpan => ({
  traceId,
  spanId,
  serviceName,
  parentSpanId,
  isError,
  duration: 100,
  startTime,
});

const rank = (traces: TraceSpan[][], services: string[]) =>
  ranker.rank({
    findings: services.map((serviceName, index) => ({
      id: `f${index}`,
      type: "latency",
      serviceName,
      timestamp: "2026-01-01T00:00:00Z",
      severity: "critical" as const,
    })),
    traces,
  });

const propagation = (traces: TraceSpan[][], service: string) => {
  const candidate = rank(traces, [service]).candidates.find((item) => item.serviceName === service && item.candidateType === "service");
  return { score: candidate?.signalScores.errorPropagation, evidence: candidate?.signalEvidence.errorPropagation, limitations: candidate?.limitations ?? [] };
};

const chain = (startTimes: [number, number, number] = [0, 10, 20], traceId = "t1") => [
  span("a", "A", undefined, true, startTimes[0], traceId),
  span("b", "B", "a", true, startTimes[1], traceId),
  span("c", "C", "b", true, startTimes[2], traceId),
];

describe("structural error propagation", () => {
  it("makes the deepest erroring service the origin and the erroring callers propagated to", () => {
    const { score, evidence } = propagation([chain()], "C");
    expect(evidence).toMatchObject({ originTraces: 1, inconclusiveTraces: 0, absorbedCount: 0 });
    expect(evidence?.propagatedTo).toEqual(["A", "B"]);
    expect(score).toBe(1);
  });

  it("scores a service that only fails because a dependency failed as a measured zero", () => {
    const { score, evidence } = propagation([chain()], "B");
    expect(score).toBe(0);
    expect(evidence).toMatchObject({ originTraces: 0, propagatedTo: [] });
    expect(propagation([chain()], "A").score).toBe(0);
  });

  it("credits every origin when two siblings fail at once", () => {
    const fanOut = [span("r", "R", undefined, true), span("x", "X", "r", true), span("y", "Y", "r", true)];
    expect(propagation([fanOut], "X").evidence).toMatchObject({ originTraces: 1, propagatedTo: ["R"] });
    expect(propagation([fanOut], "Y").evidence).toMatchObject({ originTraces: 1, propagatedTo: ["R"] });
    expect(propagation([fanOut], "R").score).toBe(0);
  });

  it("counts an error whose caller did not fail as absorbed, and halves the score because it did not spread", () => {
    const absorbed = [span("r", "R"), span("x", "X", "r", true)];
    const { score, evidence } = propagation([absorbed], "X");
    expect(evidence).toMatchObject({ originTraces: 1, absorbedCount: 1, propagatedTo: [] });
    expect(score).toBe(0.5);
  });

  it("multiplies origin share by reach, so an origin in half the error traces scores lower", () => {
    const originHere = chain([0, 10, 20], "t1");
    const victimHere = [span("a2", "A", undefined, true, 0, "t2"), span("c2", "C", "a2", true, 0, "t2"), span("d2", "D", "c2", true, 0, "t2")];
    const { score, evidence } = propagation([originHere, victimHere], "C");
    expect(evidence?.originTraces).toBe(1);
    expect(score).toBeCloseTo(0.5 * (0.5 + 0.5 * 1), 5);
  });

  it("calls a trace inconclusive when an erroring span's parent is missing", () => {
    const orphan = [span("x", "X", "missing-parent", true)];
    const conclusive = [span("r", "R", undefined, true, 0, "t2"), span("x2", "X", "r", true, 0, "t2")];
    const { evidence, score } = propagation([orphan, conclusive], "X");
    expect(evidence?.inconclusiveTraces).toBe(1);
    expect(evidence?.originTraces).toBe(1);
    expect(score).toBeGreaterThan(0);
  });

  it("drops the signal when more than half of the error traces are inconclusive", () => {
    const orphan = (id: string) => [span(`x${id}`, "X", "missing-parent", true, 0, id)];
    const { score, evidence, limitations } = propagation([orphan("t1"), orphan("t2"), [span("r", "R", undefined, true, 0, "t3"), span("x3", "X", "r", true, 0, "t3")]], "X");
    expect(score).toBeUndefined();
    expect(evidence).toBeUndefined();
    expect(limitations).toContain("Missing error data for propagation analysis");
  });

  it("gives identical results however the clocks are skewed", () => {
    const ordered = propagation([chain([0, 10, 20])], "C");
    const reversed = propagation([chain([500, 100, 1])], "C");
    expect(reversed).toEqual(ordered);
  });

  it("reports a measured zero with no origins when the loaded traces contain no errors", () => {
    const clean = [span("r", "R"), span("x", "X", "r")];
    expect(propagation([clean], "X")).toMatchObject({ score: 0, evidence: { originTraces: 0, inconclusiveTraces: 0, propagatedTo: [], absorbedCount: 0 } });
  });

  it("keeps the signal absent when the candidate is in no loaded trace", () => {
    expect(propagation([chain()], "Z").score).toBeUndefined();
  });

  it("lists at most three example traces and spans where the candidate was the origin", () => {
    const traces = ["t1", "t2", "t3", "t4", "t5"].map((id) => [span(`r-${id}`, "R", undefined, true, 0, id), span(`x-${id}`, "X", `r-${id}`, true, 0, id)]);
    const { evidence } = propagation(traces, "X");
    expect(evidence?.originTraces).toBe(5);
    expect(evidence?.examples).toHaveLength(3);
    expect(evidence?.examples?.[0]).toEqual({ traceId: "t1", spanId: "x-t1" });
  });

  it("says queue and async links across traces are not followed", () => {
    expect(rank([chain()], ["C"]).limitations).toContain("Error propagation follows parent spans within one trace; queue and async links between traces are not followed");
  });

  it("no longer reads error timestamps or claims downstream errors follow", () => {
    const { evidence } = propagation([chain()], "C");
    expect(evidence).not.toHaveProperty("downstreamErrorsFollow");
    expect(evidence).not.toHaveProperty("firstErrorTimestamp");
  });
});
