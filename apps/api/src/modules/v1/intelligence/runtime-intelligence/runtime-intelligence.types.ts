import type { TelemetryIdentity } from "../telemetry-identity.types";

export interface RuntimeMetrics {
  cpuUsagePercent: number;
  heapUsedMB: number;
  heapTotalMB: number;
  heapLimitMB: number;
  externalMB: number;
  arrayBuffersMB: number;
  eventLoopLagMs: number;
  activeHandles: number;
  activeRequests: number;
  gcPauseTimeMs: number;
  gcFrequency: number;
  timestamp: string;
  hostId?: string;
  containerId?: string;
  processId?: string;
  serviceName?: string;
}

export interface RuntimeFinding {
  identity: TelemetryIdentity;
  metric: "cpu" | "memory" | "event_loop" | "gc" | "handles" | "requests";
  observedValue: number;
  unit: string;
  severity: "warning" | "critical";
  reason: string;
  detectedAt: string;
  evidence: {
    window: { start: string; end: string };
    samples: number;
  };
}

export interface RuntimeAggregation {
  identity: TelemetryIdentity;
  avgCpuUsage: number;
  avgHeapUsedMB: number;
  avgHeapUtilization: number;
  avgEventLoopLagMs: number;
  avgGcPauseTimeMs: number;
  avgGcFrequency: number;
  avgActiveHandles: number;
  avgActiveRequests: number;
  sampleCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface RuntimeRegression {
  identity: TelemetryIdentity;
  currentAggregation: RuntimeAggregation;
  baselineAggregation: RuntimeAggregation;
  cpuChangePercent: number;
  memoryChangePercent: number;
  eventLoopChangePercent: number;
  severity: "warning" | "critical";
  detectedAt: string;
}
