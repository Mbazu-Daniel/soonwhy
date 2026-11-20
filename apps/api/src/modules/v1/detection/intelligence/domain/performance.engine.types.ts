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
