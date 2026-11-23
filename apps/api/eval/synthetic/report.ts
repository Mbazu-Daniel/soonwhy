import { METHODS } from "./run-case";
import type { BaselineComparison, CalibrationRow, CellSummary, ControlSummary, MethodScore, Report } from "./report.types";
import { mean, pairedBootstrap, reciprocalRank, wilson } from "./stats";
import type { MethodName, RunRow } from "./types";

const SINGLE_SIGNAL_BASELINES: MethodName[] = ["anomalyOnly", "criticalPathOnly", "errorPropagationOnly", "firstError", "mostErrors"];
const TIERS: CalibrationRow["tier"][] = ["high", "medium", "low"];

const isFaultRun = (row: RunRow) => row.truth.length > 0;
const hit = (rank: number | null, k: number) => rank !== null && rank <= k;
const group = <T>(items: T[], key: (item: T) => string): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
};

export function scoreMethod(rows: RunRow[], method: MethodName): MethodScore {
  const ranks = rows.map((row) => row.finalRank[method]);
  return {
    top1: wilson(ranks.filter((rank) => hit(rank, 1)).length, rows.length),
    top3: wilson(ranks.filter((rank) => hit(rank, 3)).length, rows.length),
    mrr: mean(ranks.map(reciprocalRank)),
  };
}

const scoreAll = (rows: RunRow[]) => Object.fromEntries(METHODS.map((method) => [method, scoreMethod(rows, method)])) as Record<MethodName, MethodScore>;

function summarizeCell(rows: RunRow[]): CellSummary {
  const coverage = rows.map((row) => row.coverage).filter((value): value is number => value !== null);
  const cell: CellSummary = {
    topology: rows[0]!.topology,
    scenario: rows[0]!.scenario,
    runs: rows.length,
    detected: wilson(rows.filter((row) => row.detected).length, rows.length),
    methods: scoreAll(rows),
    meanCoverage: mean(coverage),
  };
  if (rows[0]!.truth.length > 1) cell.bothTruthsInTop2 = wilson(rows.filter((row) => hit(row.fullWorstTruthRank, 2)).length, rows.length);
  return cell;
}

function summarizeControl(rows: RunRow[]): ControlSummary {
  return {
    topology: rows[0]!.topology,
    scenario: rows[0]!.scenario,
    runs: rows.length,
    falseAlarmRuns: wilson(rows.filter((row) => row.falseAlarm).length, rows.length),
  };
}

function calibrate(rows: RunRow[]): CalibrationRow[] {
  return TIERS.map((tier) => {
    const tierRows = rows.filter((row) => row.confidence === tier);
    return { tier, runs: tierRows.length, top1: wilson(tierRows.filter((row) => hit(row.finalRank.full, 1)).length, tierRows.length) };
  });
}

export function bestSingleSignalBaseline(rows: RunRow[]): MethodName {
  const score = (method: MethodName) => scoreMethod(rows, method).top1.value;
  return SINGLE_SIGNAL_BASELINES.reduce((best, method) => (score(method) > score(best) ? method : best));
}

function compareToBaseline(rows: RunRow[], baseline: MethodName): BaselineComparison {
  const indicator = (method: MethodName) => rows.map((row) => (hit(row.finalRank[method], 1) ? 1 : 0));
  const reciprocal = (method: MethodName) => rows.map((row) => reciprocalRank(row.finalRank[method]));
  const top1Difference = pairedBootstrap(indicator("full"), indicator(baseline));
  return {
    baseline,
    runs: rows.length,
    top1Difference,
    reciprocalRankDifference: pairedBootstrap(reciprocal("full"), reciprocal(baseline)),
    beatsBaseline: top1Difference.low > 0,
  };
}

export function buildReport(rows: RunRow[], split: string, baselineFrom: RunRow[] = rows): Report {
  const faults = rows.filter(isFaultRun);
  const controls = rows.filter((row) => !isFaultRun(row));
  const cells = [...group(faults, (row) => `${row.topology}/${row.scenario}`).values()].map(summarizeCell);
  const baseline = bestSingleSignalBaseline(baselineFrom.filter(isFaultRun));

  return {
    split,
    faultRuns: faults.length,
    controlRuns: controls.length,
    overall: scoreAll(faults),
    cells,
    controls: [...group(controls, (row) => `${row.topology}/${row.scenario}`).values()].map(summarizeControl),
    byTopology: [...group(faults, (row) => row.topology).entries()].map(([topology, topologyRows]) => ({ topology, runs: topologyRows.length, methods: scoreAll(topologyRows) })),
    calibration: calibrate(faults),
    baselineComparison: compareToBaseline(faults, baseline),
    scenariosWhereABaselineIsAhead: cells.flatMap((cell) =>
      SINGLE_SIGNAL_BASELINES.filter((method) => cell.methods[method].top1.value > cell.methods.full.top1.value).map((method) => ({
        topology: cell.topology,
        scenario: cell.scenario,
        baseline: method,
        fullTop1: cell.methods.full.top1.value,
        baselineTop1: cell.methods[method].top1.value,
      })),
    ),
  };
}
