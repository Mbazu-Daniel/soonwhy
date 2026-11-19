export interface PerformanceWindow {
  serviceName: string;
  endpoint: string;
  sampleCount: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  throughputPerMinute: number;
  cpuUtilization?: number;
}

export interface PerformanceBaseline {
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  throughputPerMinute: number;
  cpuUtilization?: number;
}

export interface PerformanceSignal {
  severity: "warning" | "critical";
  reasons: string[];
  latency: {
    p50: number;
    p95: number;
    p99: number;
    p95ChangePercent?: number;
    p99ChangePercent?: number;
  };
  errorRate: number;
  throughputPerMinute: number;
  cpuUtilization?: number;
}

export type ServicePerformanceThresholds = Partial<{
  minSamples: number;
  warningP95Ms: number;
  criticalP95Ms: number;
  warningErrorRate: number;
  criticalErrorRate: number;
  regressionPercent: number;
}>;
