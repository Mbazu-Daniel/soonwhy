import type { TelemetryIdentity } from "../telemetry-identity.types";

export type PerformanceSeverity = "warning" | "critical" | "candidate";

export interface PerformanceFinding {
  identity: TelemetryIdentity;
  metric: string;
  observedValue: number;
  unit: string;
  baselineValue?: number;
  changePercent?: number;
  severity: PerformanceSeverity;
  reason: string;
  detectedAt: string;
  evidence: PerformanceEvidence;
}

export interface PerformanceEvidence {
  window: {
    start: string;
    end: string;
  };
  samples: number;
  percentiles?: {
    p50: number;
    p95: number;
    p99: number;
  };
  affectedRequests?: number;
  totalRequests?: number;
}

export interface LatencyFinding extends PerformanceFinding {
  metric: "latency";
  percentile?: "p50" | "p95" | "p99";
  operationName?: string;
  resourceName?: string;
}

export interface ThroughputFinding extends PerformanceFinding {
  metric: "throughput";
  endpoint?: string;
}

export interface SpanFinding extends PerformanceFinding {
  metric: "span_duration";
  spanName: string;
  traceId?: string;
  parentSpanId?: string;
}

export interface ResourceFinding extends PerformanceFinding {
  metric: "cpu" | "memory" | "event_loop" | "disk_io" | "network_io" | "connection_pool";
  hostId?: string;
  containerId?: string;
  processId?: string;
}

export type AnyPerformanceFinding =
  | LatencyFinding
  | ThroughputFinding
  | SpanFinding
  | ResourceFinding;

export interface PerformanceBaseline {
  value: number;
  samples: number;
  period: string;
  calculatedAt: string;
}

export interface PerformanceDetectionConfig {
  minimumSamples: number;
  latencyWarningAbsoluteMs: number;
  latencyWarningRelative: number;
  latencyCriticalRelative: number;
  throughputWarningDecrease: number;
  throughputCriticalDecrease: number;
  spanWarningContribution: number;
  spanCriticalContribution: number;
  cpuWarningThreshold: number;
  cpuCriticalThreshold: number;
  memoryWarningThreshold: number;
  memoryCriticalThreshold: number;
  eventLoopWarningMs: number;
  eventLoopCriticalMs: number;
}
