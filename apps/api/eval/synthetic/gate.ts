import type { Baseline, GateCheck, GateFloors, GateResult } from "./gate.types";
import type { RunRow } from "./types";

export const DEFAULT_FLOORS: GateFloors = {
  minOverallTop1: 0.85,
  minControlRuns: 20,
  maxControlFalseAlarms: 0,
  scenarioMarginPoints: 0.05,
  minTierRuns: 20,
};

const CLEAN_CONTROL = "no_fault";
const isFault = (row: RunRow) => row.truth.length > 0;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

function scenarioScores(rows: RunRow[]): Record<string, { score: number; runs: number }> {
  const byScenario = new Map<string, RunRow[]>();
  for (const row of rows) byScenario.set(row.scenario, [...(byScenario.get(row.scenario) ?? []), row]);
  return Object.fromEntries(
    [...byScenario.entries()]
      .filter(([scenario]) => scenario !== CLEAN_CONTROL)
      .map(([scenario, group]) => {
        const good = group.filter((row) => (isFault(row) ? row.finalRank.full === 1 : !row.falseAlarm)).length;
        return [scenario, { score: good / group.length, runs: group.length }];
      }),
  );
}

const TIERS = ["high", "medium", "low"] as const;

function calibrationCheck(faults: RunRow[], minTierRuns: number): GateCheck {
  const measured = TIERS.flatMap((tier) => {
    const group = faults.filter((row) => row.confidence === tier);
    if (group.length < minTierRuns) return [];
    return [{ tier, runs: group.length, accuracy: group.filter((row) => row.finalRank.full === 1).length / group.length }];
  });
  const ordered = measured.every((entry, index) => index === 0 || measured[index - 1]!.accuracy >= entry.accuracy);
  const detail = measured.length === 0 ? "no tier has enough runs to measure" : measured.map((entry) => `${entry.tier} ${percent(entry.accuracy)} over ${entry.runs}`).join(", ");
  return { name: "confidence calibration", passed: ordered, detail: `${detail} (a higher tier must not be less accurate than a lower one)` };
}

export function makeBaseline(rows: RunRow[], split: string, description: string): Baseline {
  const faults = rows.filter(isFault);
  return {
    description,
    split,
    overallTop1: faults.filter((row) => row.finalRank.full === 1).length / faults.length,
    scenarios: scenarioScores(rows),
  };
}

export function evaluateGate(rows: RunRow[], baseline: Baseline, floors: GateFloors = DEFAULT_FLOORS): GateResult {
  const checks: GateCheck[] = [];
  const controls = rows.filter((row) => row.scenario === CLEAN_CONTROL);
  const falseAlarms = controls.filter((row) => row.falseAlarm).length;
  checks.push({
    name: "controls",
    passed: controls.length >= floors.minControlRuns && falseAlarms <= floors.maxControlFalseAlarms,
    detail: `${falseAlarms} false alarms in ${controls.length} no-fault runs (need at least ${floors.minControlRuns} runs and at most ${floors.maxControlFalseAlarms} false alarms)`,
  });

  const faults = rows.filter(isFault);
  const overall = faults.length === 0 ? 0 : faults.filter((row) => row.finalRank.full === 1).length / faults.length;
  checks.push({ name: "overall top-1", passed: overall >= floors.minOverallTop1, detail: `${percent(overall)} over ${faults.length} fault runs (floor ${percent(floors.minOverallTop1)})` });

  checks.push(calibrationCheck(faults, floors.minTierRuns));

  const current = scenarioScores(rows);
  for (const [scenario, recorded] of Object.entries(baseline.scenarios)) {
    const now = current[scenario];
    const floor = recorded.score - floors.scenarioMarginPoints;
    checks.push({
      name: `scenario ${scenario}`,
      passed: now !== undefined && now.score >= floor,
      detail: now === undefined ? "no runs for this scenario" : `${percent(now.score)} over ${now.runs} runs (baseline ${percent(recorded.score)}, floor ${percent(Math.max(0, floor))})`,
    });
  }
  return { passed: checks.every((check) => check.passed), checks };
}

export function renderGate(result: GateResult): string {
  const lines = result.checks.map((check) => `| ${check.passed ? "pass" : "FAIL"} | ${check.name} | ${check.detail} |`);
  return ["| result | check | detail |", "| --- | --- | --- |", ...lines, "", result.passed ? "Gate passed." : "Gate FAILED."].join("\n");
}
