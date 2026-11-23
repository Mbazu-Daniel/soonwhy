import { describe, expect, it } from "vitest";
import { buildRankingInputs } from "./root-cause.inputs";
import type { SpanRecord } from "./root-cause.inputs.types";
import { RootCauseRanker } from "./root-cause.ranker";
import type { RankingInput } from "./root-cause.ranker.types";

type Finding = RankingInput["findings"][number];

const ranker = new RootCauseRanker();
const NOW = "2026-01-01T00:00:00Z";

const finding = (over: Partial<Finding> & Pick<Finding, "id">): Finding => ({
  type: "latency",
  serviceName: "api",
  timestamp: NOW,
  ...over,
});

const candidateFor = (input: RankingInput, serviceName = "api") => {
  const candidate = ranker.rank(input).candidates.find((item) => item.serviceName === serviceName && item.candidateType === "service");
  if (!candidate) throw new Error(`no candidate for ${serviceName}`);
  return candidate;
};

describe("anomaly severity is absent, not zero, when there is nothing to measure", () => {
  it("leaves the signal out when the candidate has no severity, deviation or anomaly score", () => {
    const candidate = candidateFor({ findings: [finding({ id: "f1" })] });
    expect(candidate.signalScores.anomalySeverity).toBeUndefined();
    expect(candidate.signalEvidence.anomalySeverity).toBeUndefined();
    expect(candidate.limitations).toContain("Missing anomaly severity data");
  });

  it("measures it once any one of severity, deviation or anomaly score is present", () => {
    expect(candidateFor({ findings: [finding({ id: "f1", severity: "warning" })] }).signalScores.anomalySeverity).toBeGreaterThan(0);
    expect(candidateFor({ findings: [finding({ id: "f1", observedValue: 300, baselineValue: 100 })] }).signalScores.anomalySeverity).toBeGreaterThan(0);
    expect(candidateFor({ findings: [finding({ id: "f1", data: { anomalyScore: 0.4 } })] }).signalScores.anomalySeverity).toBe(0.4);
  });

  it("does not let a candidate with no anomaly data score as if it were fully measured", () => {
    const nothing = candidateFor({ findings: [finding({ id: "f1" })] });
    expect(nothing.score).toBe(0);
    expect(nothing.evidenceCoverage).toBe(0);
  });
});

describe("critical path and error propagation need the candidate to be in a loaded trace", () => {
  const trace = (service: string) => [{ spanId: "s1", serviceName: service, duration: 1000, startTime: 0, isCriticalPath: true }];
  const base = [finding({ id: "f1", severity: "critical", observedValue: 900, baselineValue: 100 })];

  it("marks both signals absent when traces were loaded but none contains the candidate", () => {
    const candidate = candidateFor({ findings: base, traces: [trace("other")] });
    expect(candidate.signalScores.criticalPathContribution).toBeUndefined();
    expect(candidate.signalScores.errorPropagation).toBeUndefined();
    expect(candidate.limitations).toContain("Missing trace data for critical-path analysis");
  });

  it("measures both once the candidate appears in a loaded trace, and a measured zero stays measured", () => {
    const candidate = candidateFor({ findings: base, traces: [trace("api")] });
    expect(candidate.signalScores.criticalPathContribution).toBeGreaterThan(0);
    expect(candidate.signalScores.errorPropagation).toBe(0);
  });
});

describe("evidence coverage is the share of signal weight that was measured", () => {
  it("is zero with nothing measured", () => {
    expect(candidateFor({ findings: [finding({ id: "f1" })] }).evidenceCoverage).toBe(0);
  });

  it("weights anomaly severity at 30 percent", () => {
    expect(candidateFor({ findings: [finding({ id: "f1", severity: "critical" })] }).evidenceCoverage).toBeCloseTo(0.3, 5);
  });

  it("adds graph position at 25 percent", () => {
    const dependencyMap = new Map([["api", { upstream: [], downstream: ["web"] }]]);
    expect(candidateFor({ findings: [finding({ id: "f1", severity: "critical" })], dependencyMap }).evidenceCoverage).toBeCloseTo(0.55, 5);
  });

  it("is the mean of the candidates for the overall figure", () => {
    const result = ranker.rank({ findings: [finding({ id: "f1", severity: "critical" }), finding({ id: "f2", serviceName: "db" })] });
    const coverages = result.candidates.map((candidate) => candidate.evidenceCoverage).sort();
    expect(coverages).toEqual([0, 0.3]);
    expect(result.overallEvidenceCoverage).toBeCloseTo(0.15, 5);
  });

  it("is zero, not NaN, when there are no candidates", () => {
    expect(ranker.rank({ findings: [] }).overallEvidenceCoverage).toBe(0);
  });
});

describe("confidence tiers", () => {
  const confidenceAt = (score: number) =>
    candidateFor({ findings: [finding({ id: "f1", data: { anomalyScore: score } })] }).confidence;

  it("is high at 0.75 or more, medium at 0.5 or more, low below", () => {
    expect(confidenceAt(0.75)).toBe("high");
    expect(confidenceAt(0.74)).toBe("medium");
    expect(confidenceAt(0.5)).toBe("medium");
    expect(confidenceAt(0.49)).toBe("low");
  });

  it("reports the top candidate's tier for the whole result and low when there are none", () => {
    const result = ranker.rank({ findings: [finding({ id: "f1", data: { anomalyScore: 0.9 } })] });
    expect(result.confidence).toBe("high");
    expect(ranker.rank({ findings: [] }).confidence).toBe("low");
  });
});

describe("anomaly aggregation does not depend on finding order", () => {
  const findings: Finding[] = [
    finding({ id: "a", severity: "critical", observedValue: 150, baselineValue: 100 }),
    finding({ id: "b", severity: "warning", observedValue: 900, baselineValue: 100 }),
    finding({ id: "c", severity: "warning", observedValue: 200, baselineValue: 100 }),
  ];

  it("gives the same result for every ordering of the findings", () => {
    const orders = [[0, 1, 2], [2, 1, 0], [1, 0, 2], [1, 2, 0]];
    const results = orders.map((order) => {
      const candidate = candidateFor({ findings: order.map((index) => findings[index]!) });
      return JSON.stringify({ anomaly: candidate.anomalyData, ids: candidate.findingIds, score: candidate.score });
    });
    expect(new Set(results).size).toBe(1);
  });

  it("keeps the highest severity, not the last one seen", () => {
    expect(candidateFor({ findings }).anomalyData.severity).toBe("critical");
    expect(candidateFor({ findings: [...findings].reverse() }).anomalyData.severity).toBe("critical");
  });

  it("takes observed, baseline and deviation together from the finding with the largest deviation", () => {
    expect(candidateFor({ findings }).anomalyData).toMatchObject({ observedValue: 900, baselineValue: 100, percentageDeviation: 800 });
  });

  it("records how many findings were aggregated", () => {
    expect(candidateFor({ findings }).anomalyData.findingsAggregated).toBe(3);
  });

  it("counts a zero observed value and a zero baseline instead of skipping them", () => {
    const zero = candidateFor({ findings: [finding({ id: "z", observedValue: 0, baselineValue: 50 })] }).anomalyData;
    expect(zero).toMatchObject({ observedValue: 0, baselineValue: 50, percentageDeviation: -100 });
  });

  it("treats a zero baseline with a positive observed value as a saturated deviation and flags it", () => {
    const candidate = candidateFor({ findings: [finding({ id: "z", observedValue: 40, baselineValue: 0 })] });
    expect(candidate.anomalyData.baselineZero).toBe(true);
    expect(candidate.anomalyData.percentageDeviation).toBeGreaterThanOrEqual(100);
    expect(candidate.signalScores.anomalySeverity).toBe(1);
  });

  it("does not flag a zero baseline when nothing was observed", () => {
    const candidate = candidateFor({ findings: [finding({ id: "z", observedValue: 0, baselineValue: 0 })] });
    expect(candidate.anomalyData.baselineZero).toBeUndefined();
    expect(candidate.anomalyData.percentageDeviation).toBe(0);
  });
});

describe("critical path evidence carries real numbers", () => {
  const spans = (traceId: string, selfTime: number, total: number) => [
    { spanId: `${traceId}-root`, traceId, serviceName: "gateway", duration: total, startTime: 0, isCriticalPath: true },
    { spanId: `${traceId}-db`, traceId, serviceName: "db", duration: selfTime, startTime: 0, parentSpanId: `${traceId}-root`, isCriticalPath: true },
  ];
  const findings = [finding({ id: "f1", serviceName: "db", severity: "critical", observedValue: 900, baselineValue: 100 })];

  it("reports span duration, contribution percent and trace duration as means over the traces that contain the candidate", () => {
    const candidate = candidateFor({ findings, traces: [spans("t1", 650, 1000), spans("t2", 350, 1000)] }, "db");
    expect(candidate.signalEvidence.criticalPathContribution).toMatchObject({
      spanDuration: 500,
      traceDuration: 1000,
      contributionPercent: 50,
      isOnCriticalPath: true,
    });
  });

  it("lists up to five traces, largest contribution first, with the exact spans", () => {
    const traces = Array.from({ length: 7 }, (_, index) => spans(`t${index + 1}`, 100 * (index + 1), 1000));
    const perTrace = candidateFor({ findings, traces }, "db").signalEvidence.criticalPathContribution?.perTrace ?? [];
    expect(perTrace).toHaveLength(5);
    expect(perTrace[0]).toEqual({ traceId: "t7", spanIds: ["t7-db"], selfTimeMs: 700, traceDurationMs: 1000, percent: 70, onCriticalPath: true });
    expect(perTrace.map((entry) => entry.percent)).toEqual([70, 60, 50, 40, 30]);
  });
});

describe("the error window keeps the newest errors", () => {
  const span = (index: number, over: Partial<SpanRecord> = {}): SpanRecord => ({
    traceId: `t${index}`,
    spanId: `s${index}`,
    name: "op",
    duration: 10,
    timestamp: new Date(1_000_000 + index * 1000).toISOString(),
    service: "payments",
    statusCode: 2,
    ...over,
  });

  it("drops the oldest errors when the cap truncates, and returns the rest in ascending order", () => {
    const traces = Array.from({ length: 350 }, (_, index) => [span(index)]);
    const { errors, errorsTotal } = buildRankingInputs(traces);
    expect(errors).toHaveLength(300);
    expect(errorsTotal).toBe(350);
    expect(errors[0]?.traceId).toBe("t50");
    expect(errors.at(-1)?.traceId).toBe("t349");
    const times = errors.map((error) => Date.parse(error.timestamp));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  const keptErrors = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ timestamp: NOW, serviceName: "api", traceId: `t${index}`, errorMessage: "boom" }));

  it("adds a limitation that names how many errors were kept", () => {
    const result = ranker.rank({ findings: [finding({ id: "f1", severity: "critical" })], errors: keptErrors(300), errorsTotal: 1240 });
    expect(result.limitations).toContain("Error list truncated: 300 of 1,240");
  });

  it("adds no truncation limitation when everything fit", () => {
    const result = ranker.rank({ findings: [finding({ id: "f1", severity: "critical" })], errors: keptErrors(12), errorsTotal: 12 });
    expect(result.limitations.some((text) => text.startsWith("Error list truncated"))).toBe(false);
  });
});

describe("a partial trace load is visible and lowers confidence", () => {
  const confident = [finding({ id: "f1", data: { anomalyScore: 0.9 } })];
  const load = (loaded: number, failed: number, notFound: number) => ({ requested: loaded + failed + notFound, loaded, failed, notFound });

  it("adds no limitation and keeps the tier when every requested trace loaded", () => {
    const result = ranker.rank({ findings: confident, traceLoad: load(20, 0, 0) });
    expect(result.limitations.some((text) => text.startsWith("Loaded"))).toBe(false);
    expect(result.confidence).toBe("high");
  });

  it("says how many loaded and how many failed", () => {
    const result = ranker.rank({ findings: confident, traceLoad: load(14, 6, 0) });
    expect(result.limitations).toContain("Loaded 14 of 20 traces (6 failed)");
  });

  it("counts sampled-out traces separately from errors", () => {
    const result = ranker.rank({ findings: confident, traceLoad: load(14, 4, 2) });
    expect(result.limitations).toContain("Loaded 14 of 20 traces (4 failed, 2 not found)");
    expect(ranker.rank({ findings: confident, traceLoad: load(18, 0, 2) }).limitations).toContain("Loaded 18 of 20 traces (2 not found)");
  });

  it("keeps the tier at exactly 70 percent loaded", () => {
    expect(ranker.rank({ findings: confident, traceLoad: load(14, 6, 0) }).confidence).toBe("high");
  });

  it("drops one tier when fewer than 70 percent loaded", () => {
    const result = ranker.rank({ findings: confident, traceLoad: load(13, 7, 0) });
    expect(result.confidence).toBe("medium");
    expect(result.candidates[0]?.confidence).toBe("medium");
  });

  it("drops medium to low and never below low", () => {
    const medium = [finding({ id: "f1", data: { anomalyScore: 0.6 } })];
    expect(ranker.rank({ findings: medium, traceLoad: load(1, 9, 0) }).confidence).toBe("low");
    const low = [finding({ id: "f1", data: { anomalyScore: 0.2 } })];
    expect(ranker.rank({ findings: low, traceLoad: load(1, 9, 0) }).confidence).toBe("low");
  });

  it("reports an all-not-found load and treats it as low coverage", () => {
    const result = ranker.rank({ findings: confident, traceLoad: load(0, 0, 3) });
    expect(result.limitations).toContain("Loaded 0 of 3 traces (3 not found)");
    expect(result.confidence).toBe("medium");
  });

  it("ignores a load that requested nothing", () => {
    const result = ranker.rank({ findings: confident, traceLoad: load(0, 0, 0) });
    expect(result.confidence).toBe("high");
    expect(result.limitations.some((text) => text.startsWith("Loaded"))).toBe(false);
  });
});
