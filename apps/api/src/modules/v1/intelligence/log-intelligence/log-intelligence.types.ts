import type { TelemetryIdentity } from "@soonwhy/shared";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  traceId?: string;
  spanId?: string;
  serviceName?: string;
  endpoint?: string;
  userId?: string;
  deploymentId?: string;
  hostId?: string;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface LogCorrelation {
  traceId: string;
  logs: LogEntry[];
  logsBySpan: Map<string, LogEntry[]>;
  errorLogs: LogEntry[];
  warningLogs: LogEntry[];
  timeWindow: {
    start: string;
    end: string;
  };
}

export interface LogTraceFinding {
  identity: TelemetryIdentity;
  findingType: "error_in_trace" | "warning_pattern" | "log_anomaly" | "missing_context";
  severity: "info" | "warning" | "critical";
  evidence: string[];
  confidence: number;
  correlation: {
    traceId: string;
    spanId?: string;
    serviceName?: string;
    endpoint?: string;
  };
}

export interface LogPattern {
  pattern: string;
  count: number;
  samples: LogEntry[];
  severity: LogLevel;
  services: string[];
}

export interface LogAnomaly {
  anomalyType: "volume_spike" | "error_rate_increase" | "unusual_pattern";
  baselineValue: number;
  currentValue: number;
  changePercent: number;
  severity: "warning" | "critical";
  evidence: string[];
  confidence: number;
}
