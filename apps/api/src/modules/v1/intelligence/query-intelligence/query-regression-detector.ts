import type {
  QueryAggregation,
  QueryRegression,
} from "./query-intelligence.types";

export function detectQueryRegression(
  current: QueryAggregation,
  baseline: QueryAggregation,
  latencyThreshold: number = 0.5,
  errorRateThreshold: number = 1.0,
  frequencyThreshold: number = 2.0,
): QueryRegression | undefined {
  const latencyChange = (current.avgDurationMs - baseline.avgDurationMs) / baseline.avgDurationMs;
  const latencyRegressed = latencyChange >= latencyThreshold;

  const errorRateChange = current.errorRate - baseline.errorRate;
  const errorRateRegressed = errorRateChange >= errorRateThreshold;

  const currentFreq = current.executionCount / getTimeWindowMs(current);
  const baselineFreq = baseline.executionCount / getTimeWindowMs(baseline);
  const frequencyChange = currentFreq / baselineFreq;
  const frequencyRegressed = frequencyChange >= frequencyThreshold;

  if (!latencyRegressed && !errorRateRegressed && !frequencyRegressed) {
    return undefined;
  }

  const critical =
    latencyChange >= 1.0 ||
    errorRateChange >= 2.0 ||
    frequencyChange >= 5.0;

  return {
    queryIdentity: current.queryIdentity,
    currentAggregation: current,
    baselineAggregation: baseline,
    latencyChangePercent: latencyChange * 100,
    errorRateChangePercent: errorRateChange * 100,
    frequencyChangePercent: (frequencyChange - 1) * 100,
    severity: critical ? "critical" : "warning",
    detectedAt: new Date().toISOString(),
  };
}

function getTimeWindowMs(aggregation: QueryAggregation): number {
  const start = new Date(aggregation.firstSeenAt).getTime();
  const end = new Date(aggregation.lastSeenAt).getTime();
  return end - start || 1;
}
