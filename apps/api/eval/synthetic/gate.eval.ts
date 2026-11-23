import { describe, expect, it } from "vitest";
import { evaluateGate, makeBaseline, renderGate } from "./gate";
import type { MethodName, RunRow } from "./types";

const ranks = (full: number | null): Record<MethodName, number | null> => ({ full, anomalyOnly: 1, criticalPathOnly: 1, errorPropagationOnly: 1, firstError: 1, mostErrors: 1 });

const fault = (scenario: string, index: number, full: number | null = 1): RunRow => ({
  topology: "six", scenario, caseId: `${scenario}/db`, rep: index, seed: index, split: "tuning", truth: ["db"], detected: true,
  preOnsetFinding: false, falseAlarm: true, initialRank: ranks(full), finalRank: ranks(full), fullWorstTruthRank: full, confidence: "high", coverage: 1,
});

const control = (scenario: string, index: number, falseAlarm = false): RunRow => ({ ...fault(scenario, index), truth: [], falseAlarm, finalRank: ranks(null) });

const good = [
  ...Array.from({ length: 20 }, (_, index) => fault("serial_delay", index)),
  ...Array.from({ length: 20 }, (_, index) => fault("error_rate", index)),
  ...Array.from({ length: 20 }, (_, index) => control("no_fault", index)),
  ...Array.from({ length: 10 }, (_, index) => control("latency_noise", index)),
];
const baseline = makeBaseline(good, "tuning", "test");

describe("eval gate", () => {
  it("builds a baseline with a score per scenario, counting benign cases by their alarm-free rate", () => {
    expect(baseline.scenarios.serial_delay).toEqual({ score: 1, runs: 20 });
    expect(baseline.scenarios.latency_noise).toEqual({ score: 1, runs: 10 });
    expect(baseline.scenarios.no_fault).toBeUndefined();
    expect(baseline.overallTop1).toBe(1);
  });

  it("passes the run it was recorded from", () => {
    expect(evaluateGate(good, baseline).passed).toBe(true);
  });

  it("fails on a single false alarm among the no-fault controls", () => {
    const rows = good.map((row, index) => (row.scenario === "no_fault" && index === 45 ? { ...row, falseAlarm: true } : row));
    const result = evaluateGate(rows, baseline);
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === "controls")?.passed).toBe(false);
  });

  it("fails when there are fewer than 20 control runs, so a skipped control cannot pass", () => {
    const rows = good.filter((row) => row.scenario !== "no_fault" || row.rep < 19);
    expect(evaluateGate(rows, baseline).checks.find((check) => check.name === "controls")?.passed).toBe(false);
  });

  it("fails when overall top-1 falls under 85 percent", () => {
    const rows = good.map((row) => (row.truth.length > 0 && row.rep < 8 ? { ...row, finalRank: ranks(2) } : row));
    expect(evaluateGate(rows, baseline).checks.find((check) => check.name === "overall top-1")?.passed).toBe(false);
  });

  it("allows a scenario to dip 5 points below its baseline and fails at 10", () => {
    const dip = (misses: number) => good.map((row) => (row.scenario === "serial_delay" && row.rep < misses ? { ...row, finalRank: ranks(3) } : row));
    expect(evaluateGate(dip(1), baseline).checks.find((check) => check.name === "scenario serial_delay")?.passed).toBe(true);
    expect(evaluateGate(dip(2), baseline).checks.find((check) => check.name === "scenario serial_delay")?.passed).toBe(false);
  });

  it("fails when a baseline scenario has no runs at all", () => {
    expect(evaluateGate(good.filter((row) => row.scenario !== "error_rate"), baseline).passed).toBe(false);
  });

  it("renders every check and the verdict", () => {
    const text = renderGate(evaluateGate(good, baseline));
    expect(text).toContain("scenario serial_delay");
    expect(text).toContain("Gate passed.");
  });

  it("fails when a higher confidence tier is less accurate than a lower one", () => {
    const withTier = (tier: "high" | "medium" | "low", correct: number, wrong: number): RunRow[] => [
      ...Array.from({ length: correct }, (_, index) => ({ ...fault("serial_delay", index), confidence: tier })),
      ...Array.from({ length: wrong }, (_, index) => ({ ...fault("serial_delay", index + 100, 2), confidence: tier })),
    ];
    const calibrated = [...good, ...withTier("high", 30, 0), ...withTier("medium", 28, 2), ...withTier("low", 20, 10)];
    const inverted = [...good, ...withTier("high", 20, 10), ...withTier("medium", 30, 0), ...withTier("low", 30, 0)];

    expect(evaluateGate(calibrated, makeBaseline(calibrated, "tuning", "t")).checks.find((c) => c.name === "confidence calibration")?.passed).toBe(true);
    expect(evaluateGate(inverted, makeBaseline(inverted, "tuning", "t")).checks.find((c) => c.name === "confidence calibration")?.passed).toBe(false);
  });

  it("does not judge a tier it has too few runs to measure", () => {
    const rows = [...good, ...Array.from({ length: 3 }, (_, index) => ({ ...fault("serial_delay", index + 200, 2), confidence: "low" as const }))];
    expect(evaluateGate(rows, makeBaseline(rows, "tuning", "t")).checks.find((c) => c.name === "confidence calibration")?.passed).toBe(true);
  });
});
