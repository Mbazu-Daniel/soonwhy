import type {
  PerformanceBaseline,
  PerformanceImpact,
  PerformanceMetric,
  PerformanceSignal,
  PerformanceWindow,
  PersistenceResult,
} from './performance.types';

export interface PerformanceThresholds {
  minimumBaselineSamples: number;
  latencyWarningAbsoluteMs: number;
  latencyWarningRelative: number;
  latencyCriticalRelative: number;
  throughputWarningDecrease: number;
  throughputCriticalDecrease: number;
  traceWarningContribution: number;
  traceCriticalContribution: number;
}

export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  minimumBaselineSamples: 20,
  latencyWarningAbsoluteMs: 250,
  latencyWarningRelative: 0.5,
  latencyCriticalRelative: 1,
  throughputWarningDecrease: 0.3,
  throughputCriticalDecrease: 0.5,
  traceWarningContribution: 0.5,
  traceCriticalContribution: 0.75,
};

export function evaluateLatency(
  observedMs: number,
  baseline: PerformanceBaseline | undefined,
  thresholds: PerformanceThresholds = DEFAULT_PERFORMANCE_THRESHOLDS,
): PerformanceSignal | undefined {
  if (!isPositiveFinite(observedMs)) return undefined;
  if (!hasBaseline(baseline, thresholds.minimumBaselineSamples)) {
    return {
      metric: 'latency',
      observedValue: observedMs,
      unit: 'ms',
      severity: 'candidate',
      reason: 'No sufficiently sampled comparable baseline is available.',
    };
  }

  const change = (observedMs - baseline.value) / baseline.value;
  const absoluteIncrease = observedMs - baseline.value;
  if (absoluteIncrease < thresholds.latencyWarningAbsoluteMs || change < thresholds.latencyWarningRelative) {
    return undefined;
  }

  return {
    metric: 'latency',
    observedValue: observedMs,
    unit: 'ms',
    baselineValue: baseline.value,
    changePercent: change * 100,
    severity: change >= thresholds.latencyCriticalRelative ? 'critical' : 'warning',
    reason: 'Latency increased materially against the comparable baseline.',
  };
}

export function evaluateThroughput(
  observedRequests: number,
  baseline: PerformanceBaseline | undefined,
  thresholds: PerformanceThresholds = DEFAULT_PERFORMANCE_THRESHOLDS,
): PerformanceSignal | undefined {
  if (!Number.isFinite(observedRequests) || observedRequests < 0) return undefined;
  if (!hasBaseline(baseline, thresholds.minimumBaselineSamples) || baseline.value <= 0) return undefined;

  const change = (observedRequests - baseline.value) / baseline.value;
  const decrease = -change;
  if (decrease < thresholds.throughputWarningDecrease) return undefined;

  return {
    metric: 'throughput',
    observedValue: observedRequests,
    unit: 'requests',
    baselineValue: baseline.value,
    changePercent: change * 100,
    severity: decrease >= thresholds.throughputCriticalDecrease ? 'critical' : 'warning',
    reason: 'Request throughput dropped materially against the comparable baseline.',
  };
}

export function evaluateTraceContribution(
  spanDurationMs: number,
  traceDurationMs: number,
  thresholds: PerformanceThresholds = DEFAULT_PERFORMANCE_THRESHOLDS,
): PerformanceSignal | undefined {
  if (!isPositiveFinite(spanDurationMs) || !isPositiveFinite(traceDurationMs) || spanDurationMs > traceDurationMs) {
    return undefined;
  }

  const contribution = spanDurationMs / traceDurationMs;
  if (contribution < thresholds.traceWarningContribution) return undefined;

  return {
    metric: 'trace_contribution',
    observedValue: contribution * 100,
    unit: '%',
    severity: contribution >= thresholds.traceCriticalContribution ? 'critical' : 'warning',
    reason: 'A single span contributes a large share of the trace duration.',
  };
}

export function compareImpact(
  affected: PerformanceBaseline,
  unaffected: PerformanceBaseline,
): PerformanceImpact | undefined {
  if (!isPositiveFinite(affected.value) || !isPositiveFinite(unaffected.value) ||
      affected.samples <= 0 || unaffected.samples <= 0) return undefined;

  return {
    affectedValue: affected.value,
    unaffectedValue: unaffected.value,
    ratio: affected.value / unaffected.value,
    affectedSamples: affected.samples,
    unaffectedSamples: unaffected.samples,
  };
}

export function evaluatePersistence(
  windows: PerformanceWindow[],
  predicate: (window: PerformanceWindow) => boolean,
  requiredWindows = 3,
): PersistenceResult {
  const validRequiredWindows = Math.max(1, requiredWindows);
  const matchingWindows = windows.filter(predicate).length;

  return {
    windows: matchingWindows,
    requiredWindows: validRequiredWindows,
    persistent: matchingWindows >= validRequiredWindows,
  };
}

function hasBaseline(
  baseline: PerformanceBaseline | undefined,
  minimumSamples: number,
): baseline is PerformanceBaseline {
  return baseline !== undefined &&
    Number.isFinite(baseline.value) &&
    baseline.value >= 0 &&
    Number.isFinite(baseline.samples) &&
    baseline.samples >= minimumSamples;
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
