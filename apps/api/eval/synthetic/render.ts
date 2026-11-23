import type { MethodScore, Report } from "./report.types";
import type { Interval, MethodName } from "./types";

const COLUMNS: MethodName[] = ["full", "anomalyOnly", "criticalPathOnly", "errorPropagationOnly", "firstError", "mostErrors"];
const percent = (interval: Interval) => `${(interval.value * 100).toFixed(1)} (${(interval.low * 100).toFixed(0)}-${(interval.high * 100).toFixed(0)})`;
const score = (method: MethodScore) => `${percent(method.top1)} / ${percent(method.top3)} / ${method.mrr.toFixed(2)}`;
const row = (cells: string[]) => `| ${cells.join(" | ")} |`;
const table = (header: string[], rows: string[][]) => [row(header), row(header.map(() => "---")), ...rows.map(row)].join("\n");

export function renderReport(report: Report): string {
  const comparison = report.baselineComparison;
  const lines = [
    `# Synthetic evaluation, ${report.split} split`,
    "",
    `Fault runs: ${report.faultRuns}. Control runs: ${report.controlRuns}. Cells show top-1 % (95% Wilson) / top-3 % (95% Wilson) / MRR.`,
    "",
    "## Overall",
    table(["method", "top-1 / top-3 / MRR"], COLUMNS.map((method) => [method, score(report.overall[method])])),
    "",
    "## By topology",
    table(["topology", "runs", ...COLUMNS], report.byTopology.map((entry) => [entry.topology, String(entry.runs), ...COLUMNS.map((method) => score(entry.methods[method]))])),
    "",
    "## By scenario and topology",
    table(["topology", "scenario", "runs", "detected %", "coverage", ...COLUMNS], report.cells.map((cell) => [cell.topology, cell.scenario, String(cell.runs), percent(cell.detected), cell.meanCoverage.toFixed(2), ...COLUMNS.map((method) => score(cell.methods[method]))])),
    "",
    "## Controls (false alarms per run)",
    table(["topology", "scenario", "runs", "runs with a finding % (95% Wilson)"], report.controls.map((control) => [control.topology, control.scenario, String(control.runs), percent(control.falseAlarmRuns)])),
    "",
    "## Calibration of the full ranker's confidence",
    table(["tier", "runs", "top-1 % (95% Wilson)"], report.calibration.map((entry) => [entry.tier, String(entry.runs), entry.runs === 0 ? "-" : percent(entry.top1)])),
    "",
    "## Full ranker against the best single-signal baseline",
    `Baseline: ${comparison.baseline}. Paired bootstrap over ${comparison.runs} fault runs.`,
    `Top-1 difference (full minus baseline): ${(comparison.top1Difference.value * 100).toFixed(1)} points, 95% interval ${(comparison.top1Difference.low * 100).toFixed(1)} to ${(comparison.top1Difference.high * 100).toFixed(1)}.`,
    `Reciprocal-rank difference: ${comparison.reciprocalRankDifference.value.toFixed(3)}, 95% interval ${comparison.reciprocalRankDifference.low.toFixed(3)} to ${comparison.reciprocalRankDifference.high.toFixed(3)}.`,
    `Interval excludes zero in favour of the full ranker: ${comparison.beatsBaseline ? "yes" : "NO"}.`,
    "",
    "## Cells where a single-signal baseline scores higher than the full ranker",
    report.scenariosWhereABaselineIsAhead.length === 0
      ? "None."
      : table(["topology", "scenario", "baseline", "full top-1 %", "baseline top-1 %"], report.scenariosWhereABaselineIsAhead.map((entry) => [entry.topology, entry.scenario, entry.baseline, (entry.fullTop1 * 100).toFixed(1), (entry.baselineTop1 * 100).toFixed(1)])),
  ];
  return lines.join("\n");
}
