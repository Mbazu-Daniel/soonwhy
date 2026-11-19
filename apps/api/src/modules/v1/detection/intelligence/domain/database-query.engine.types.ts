export type DatabaseQuerySeverity = "warning" | "critical";

export interface DatabaseQueryDistribution {
  p50: number;
  p95: number;
  p99: number;
  sampleCount: number;
}

export interface DatabaseQuerySignal {
  severity: DatabaseQuerySeverity;
  observedValue: number;
  threshold: number;
  baselineValue?: number;
  changePercent?: number;
  distribution: DatabaseQueryDistribution;
}

export interface DatabaseQueryThresholds {
  warningMs: number;
  criticalMs: number;
  minimumBaselineSamples: number;
  regressionAbsoluteMs: number;
  regressionRelative: number;
  criticalRegressionRelative: number;
}
