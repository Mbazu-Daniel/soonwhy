export type PerformanceMetric =
  | 'latency'
  | 'throughput'
  | 'dependency_latency'
  | 'trace_contribution';

export type PerformanceSeverity = 'candidate' | 'warning' | 'critical';

export interface PerformanceBaseline {
  value: number;
  samples: number;
}

export interface PerformanceWindow {
  start: string;
  end: string;
  value: number;
  samples: number;
}

export interface PerformanceSignal {
  metric: PerformanceMetric;
  observedValue: number;
  unit: 'ms' | '%' | 'requests';
  baselineValue?: number;
  changePercent?: number;
  severity: PerformanceSeverity;
  reason: string;
}

export interface PerformanceImpact {
  affectedValue: number;
  unaffectedValue: number;
  ratio: number;
  affectedSamples: number;
  unaffectedSamples: number;
}

export interface PersistenceResult {
  windows: number;
  requiredWindows: number;
  persistent: boolean;
}
