import { createTelemetryIdentity } from "@soonwhy/shared";

export type DependencyType =
  | "database"
  | "cache"
  | "redis"
  | "memcached"
  | "queue"
  | "http"
  | "rpc"
  | "grpc"
  | "other";

export type DependencySignal =
  | "latency"
  | "latency_regression"
  | "errors"
  | "error_regression"
  | "throughput_regression";

export interface DependencyObservation {
  serviceName: string;
  dependencyType: DependencyType;
  dependencyName: string;
  operationName?: string;
  sampleCount: number;
  baselineSampleCount?: number;
  p50Duration?: number;
  p95Duration?: number;
  p99Duration?: number;
  errorCount?: number;
  errorRate?: number;
  baselineP95Duration?: number;
  baselineErrorRate?: number;
  throughputPerMinute?: number;
  baselineThroughputPerMinute?: number;
}

export interface DependencyFinding {
  identity: ReturnType<typeof createTelemetryIdentity>;
  serviceName: string;
  dependencyType: DependencyType;
  dependencyName: string;
  operationName?: string;
  signals: DependencySignal[];
  confidence: "medium" | "high";
  latencyRegressionPercent?: number;
  errorRegressionPercent?: number;
  throughputRegressionPercent?: number;
  summary: string;
}

export type DependencyThresholds = Partial<{
  minSamples: number;
  minBaselineSamples: number;
  latencySignalMs: number;
  latencyRegressionPercent: number;
  errorSignalRate: number;
  errorRegressionPercent: number;
  errorRegressionDelta: number;
  throughputRegressionPercent: number;
}>;
