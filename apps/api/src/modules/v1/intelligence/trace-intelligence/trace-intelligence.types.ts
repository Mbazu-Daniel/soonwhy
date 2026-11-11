import type { TelemetryIdentity } from "@soonwhy/shared";

export interface Span {
  spanId: string;
  parentSpanId?: string;
  traceId: string;
  operationName: string;
  serviceName: string;
  startTime: string;
  durationMs: number;
  status: "ok" | "error";
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface Trace {
  traceId: string;
  rootSpanId: string;
  spans: Span[];
  startTime: string;
  durationMs: number;
  serviceName?: string;
  endpoint?: string;
}

export interface CriticalPathSpan {
  span: Span;
  contributionPercent: number;
  isBottleneck: boolean;
  depth: number;
}

export interface CriticalPathAnalysis {
  traceId: string;
  totalDurationMs: number;
  criticalPath: CriticalPathSpan[];
  dominantSpan: Span;
  dominantSpanContribution: number;
  slowChildSpans: Span[];
  repeatedSpans: RepeatedSpan[];
  dependencyBottlenecks: DependencyBottleneck[];
  errorLocation: Span | null;
  resourceCorrelation: ResourceCorrelation;
}

export interface RepeatedSpan {
  operationName: string;
  serviceName: string;
  count: number;
  totalDurationMs: number;
  avgDurationMs: number;
  totalContribution: number;
}

export interface DependencyBottleneck {
  serviceName: string;
  operationName: string;
  dependencyType: "http" | "grpc" | "db" | "cache" | "queue" | "custom";
  avgLatencyMs: number;
  totalLatencyMs: number;
  contributionPercent: number;
  isCritical: boolean;
}

export interface ResourceCorrelation {
  cpu: number | null;
  memory: number | null;
  disk: number | null;
  network: number | null;
  traceStart: string;
  traceEnd: string;
}

export interface TraceFinding {
  identity: TelemetryIdentity;
  findingType: "critical_path" | "dominant_span" | "slow_child" | "repeated_spans" | "dependency_bottleneck" | "error_location";
  severity: "info" | "warning" | "critical";
  evidence: string[];
  confidence: number;
  correlation: {
    traceId: string;
    endpoint?: string;
    serviceName?: string;
  };
}
