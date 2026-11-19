import { createTelemetryIdentity } from "@soonwhy/shared";

export interface PerformanceObservation {
  serviceName: string;
  endpointName: string;
  sampleCount: number;
  baselineSampleCount?: number;
  p95Duration?: number;
  baselineP95Duration?: number;
  throughputPerMinute?: number;
  baselineThroughputPerMinute?: number;
  errorRate?: number;
  baselineErrorRate?: number;
}

export type PerformanceSignal =
  | "latency"
  | "latency_regression"
  | "throughput_regression"
  | "error_regression";

export interface PerformanceFinding {
  identity: ReturnType<typeof createTelemetryIdentity>;
  serviceName: string;
  endpointName: string;
  signals: PerformanceSignal[];
  confidence: "medium" | "high";
  latencyRegressionPercent?: number;
  throughputRegressionPercent?: number;
  errorRegressionPercent?: number;
  summary: string;
}

export type PerformanceThresholds = Partial<{
  minSamples: number;
  minBaselineSamples: number;
  latencySignalMs: number;
  latencyRegressionPercent: number;
  throughputRegressionPercent: number;
  errorRegressionPercent: number;
  errorRegressionDelta: number;
}>;
