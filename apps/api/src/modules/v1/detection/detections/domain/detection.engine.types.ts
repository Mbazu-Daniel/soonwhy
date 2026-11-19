export type DetectionSignalType =
  | "latency"
  | "error_rate"
  | "dependency_latency"
  | "trace_span"
  | "throughput"
  | "seasonal_anomaly"
  | "change_point";

export interface DetectionRule {
  type: DetectionSignalType;
  threshold: number;
  criticalMultiplier: number;
  regressionRelativeIncrease: number;
  regressionAbsoluteIncrease: number;
  criticalRegressionRelativeIncrease: number;
  period?: number;
  unit: "ms" | "%" | "z-score" | "count" | "requests";
}

export interface DetectionBaseline {
  value: number;
  samples: number;
}

export interface DetectionSignal {
  type: DetectionSignalType;
  observedValue: number;
  threshold: number;
  severity: "warning" | "critical";
  unit: "ms" | "%" | "z-score" | "count" | "requests";
  baselineValue?: number;
  changePercent?: number;
  anomalyScore?: number;
  seasonalIndex?: number;
  changePointIndex?: number;
}

export type ThroughputThresholds = Partial<{
  minBaselineSamples: number;
  dropRatio: number;
  criticalChangePercent: number;
}>;
