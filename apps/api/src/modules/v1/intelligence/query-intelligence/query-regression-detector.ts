import type {
  QueryAggregation,
  QueryRegression,
} from "./query-intelligence.types";

/**
 * Detect query latency regression.
 *
 * Compares current query performance against baseline and flags
 * when query latency or error rates increase significantly.
 */
export function detectQueryRegression(
  current: QueryAggregation,
  baseline: QueryAggregation,
  latencyThreshold: number = 0.5, // 50% increase
  errorRateThreshold: number = 1.0, // 100% increase
  frequencyThreshold: number = 2.0, // 2x increase
): QueryRegression | undefined {
  // Latency regression
  const latencyChange = (current.avgDurationMs - baseline.avgDurationMs) / baseline.avgDurationMs;
  const latencyRegressed = latencyChange >= latencyThreshold;

  // Error rate regression
  const errorRateChange = current.errorRate - baseline.errorRate;
  const errorRateRegressed = errorRateChange >= errorRateThreshold;

  // Frequency regression (unusual increase in query frequency)
  const currentFreq = current.executionCount / getTimeWindowMs(current);
  const baselineFreq = baseline.executionCount / getTimeWindowMs(baseline);
  const frequencyChange = currentFreq / baselineFreq;
  const frequencyRegressed = frequencyChange >= frequencyThreshold;

  if (!latencyRegressed && !errorRateRegressed && !frequencyRegressed) {
    return undefined;
  }

  // Determine severity
  const critical =
    latencyChange >= 1.0 || // 100% latency increase
    errorRateChange >= 2.0 || // 200% error rate increase
    frequencyChange >= 5.0; // 5x frequency increase

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
  return end - start || 1; // Avoid division by zero
}
