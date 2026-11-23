import { describe, expect, it } from "vitest";
import { buildReport, bestSingleSignalBaseline } from "./report";
import { renderReport } from "./render";
import type { MethodName, RunRow } from "./types";

const ranks = (overrides: Partial<Record<MethodName, number | null>>): Record<MethodName, number | null> => ({
  full: 1, anomalyOnly: 3, criticalPathOnly: 2, errorPropagationOnly: 4, firstError: 3, mostErrors: 4, ...overrides,
});

const run = (index: number, finalRank: Record<MethodName, number | null>, over: Partial<RunRow> = {}): RunRow => ({
  topology: "six", scenario: "serial_delay", caseId: "serial_delay/db", rep: index, seed: index, split: "tuning", truth: ["db"],
  detected: true, preOnsetFinding: false, falseAlarm: true, initialRank: finalRank, finalRank, fullWorstTruthRank: finalRank.full,
  confidence: "high", coverage: 0.8, ...over,
});

describe("report", () => {
  const rows = Array.from({ length: 40 }, (_, index) => run(index, ranks({})));

  it("scores top-1, top-3 and MRR per method with Wilson intervals", () => {
    const report = buildReport(rows, "tuning");
    expect(report.overall.full.top1.value).toBe(1);
    expect(report.overall.criticalPathOnly.top1.value).toBe(0);
    expect(report.overall.criticalPathOnly.top3.value).toBe(1);
    expect(report.overall.criticalPathOnly.mrr).toBe(0.5);
    expect(report.overall.full.top1.low).toBeGreaterThan(0.9);
  });

  it("chooses the best single-signal baseline and says the full ranker beats it when it does", () => {
    const better = rows.map((row, index) => (index < 10 ? run(index, ranks({ criticalPathOnly: 1 })) : row));
    expect(bestSingleSignalBaseline(better)).toBe("criticalPathOnly");
    const comparison = buildReport(better, "tuning").baselineComparison;
    expect(comparison.baseline).toBe("criticalPathOnly");
    expect(comparison.beatsBaseline).toBe(true);
  });

  it("refuses to claim a win when a baseline is as good", () => {
    const tied = rows.map((row, index) => run(index, ranks({ criticalPathOnly: 1 })));
    expect(buildReport(tied, "tuning").baselineComparison.beatsBaseline).toBe(false);
  });

  it("lists a cell where a baseline is ahead instead of hiding it", () => {
    const losing = rows.map((row, index) => run(index, ranks({ full: 2, firstError: 1 })));
    const report = buildReport(losing, "tuning");
    expect(report.scenariosWhereABaselineIsAhead).toEqual([{ topology: "six", scenario: "serial_delay", baseline: "firstError", fullTop1: 0, baselineTop1: 1 }]);
  });

  it("keeps control runs out of the ranking metrics and reports their false alarms", () => {
    const controls = Array.from({ length: 30 }, (_, index) => run(index, ranks({}), { scenario: "no_fault", truth: [], falseAlarm: index < 3 }));
    const report = buildReport([...rows, ...controls], "tuning");
    expect(report.faultRuns).toBe(40);
    expect(report.controlRuns).toBe(30);
    expect(report.controls[0]!.falseAlarmRuns.value).toBeCloseTo(0.1, 5);
  });

  it("calibrates by confidence tier", () => {
    const mixed = [...rows.map((row) => ({ ...row, confidence: "high" as const })), ...rows.slice(0, 10).map((row) => ({ ...row, confidence: "low" as const, finalRank: ranks({ full: 3 }) }))];
    const tiers = Object.fromEntries(buildReport(mixed, "tuning").calibration.map((entry) => [entry.tier, entry]));
    expect(tiers.high.top1.value).toBe(1);
    expect(tiers.low.top1.value).toBe(0);
    expect(tiers.medium.runs).toBe(0);
  });

  it("counts both true causes only when the worse of them is in the top two", () => {
    const pair = Array.from({ length: 30 }, (_, index) => run(index, ranks({}), { truth: ["db", "fraud"], fullWorstTruthRank: index < 20 ? 2 : 4 }));
    expect(buildReport(pair, "tuning").cells[0]!.bothTruthsInTop2!.value).toBeCloseTo(20 / 30, 5);
  });

  it("renders a report that names the baseline verdict", () => {
    expect(renderReport(buildReport(rows, "tuning"))).toContain("Interval excludes zero in favour of the full ranker");
  });
});
