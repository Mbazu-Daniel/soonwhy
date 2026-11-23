import { FULL_PERCENT, SATURATED_DEVIATION_PERCENT } from "./root-cause.constants";
import type { RankingInput } from "./root-cause.ranker.types";
import type { RootCauseCandidate } from "./root-cause.types";

type Finding = RankingInput["findings"][number];
type AnomalyData = RootCauseCandidate["anomalyData"];
type Severity = NonNullable<AnomalyData["severity"]>;

const SEVERITY_RANK: Record<Severity, number> = { warning: 1, critical: 2 };

interface Deviation {
  percent: number;
  baselineZero: boolean;
}

export function deviationOf(finding: Finding): Deviation | undefined {
  const { observedValue, baselineValue } = finding;
  if (observedValue === undefined || baselineValue === undefined) return undefined;
  if (baselineValue === 0) {
    return observedValue > 0
      ? { percent: SATURATED_DEVIATION_PERCENT, baselineZero: true }
      : { percent: 0, baselineZero: false };
  }
  return { percent: ((observedValue - baselineValue) / baselineValue) * FULL_PERCENT, baselineZero: false };
}

function anomalyScoreOf(finding: Finding): number | undefined {
  const value = finding.data?.anomalyScore;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

const byLargestDeviation = (a: { finding: Finding; deviation: Deviation }, b: { finding: Finding; deviation: Deviation }) =>
  b.deviation.percent - a.deviation.percent || a.finding.id.localeCompare(b.finding.id);

export function aggregateAnomalyData(findings: Finding[]): AnomalyData {
  const data: AnomalyData = { findingsAggregated: findings.length };

  for (const { severity } of findings) {
    if (severity && (!data.severity || SEVERITY_RANK[severity] > SEVERITY_RANK[data.severity])) data.severity = severity;
  }

  const scores = findings.map(anomalyScoreOf).filter((score): score is number => score !== undefined);
  if (scores.length > 0) data.anomalyScore = Math.max(...scores);

  const measured = findings.flatMap((finding) => {
    const deviation = deviationOf(finding);
    return deviation ? [{ finding, deviation }] : [];
  });
  const largest = measured.sort(byLargestDeviation)[0];
  if (largest) {
    data.observedValue = largest.finding.observedValue;
    data.baselineValue = largest.finding.baselineValue;
    data.percentageDeviation = largest.deviation.percent;
    if (largest.deviation.baselineZero) data.baselineZero = true;
  } else {
    const observed = findings.find((finding) => finding.observedValue !== undefined);
    if (observed) data.observedValue = observed.observedValue;
  }

  return data;
}
