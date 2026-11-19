import { createTelemetryIdentity } from "@soonwhy/shared";

export interface ExternalDependencyTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  dependencyType: "http" | "rpc";
  dependencyName: string;
  statusCode?: number;
  errorType?: string;
}

export interface Signal {
  sampleCount: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  errorCount: number;
  errorRate: number;
  p95DurationChangePercent?: number;
  baselineErrorRate?: number;
  errorRateChangePercent?: number;
  degradationSignals: string[];
  confidence: "medium" | "high";
}

export interface ExternalDependencyCandidate {
  serviceName: string;
  dependencyType: string;
  dependencyName: string;
  signal: Signal;
  samples: ExternalDependencyTrace[];
  identity: ReturnType<typeof createTelemetryIdentity>;
  recommendation: string;
}
