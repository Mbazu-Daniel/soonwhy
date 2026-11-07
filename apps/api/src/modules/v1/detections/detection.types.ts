import type { DetectionEvidence } from "../../../common/db/schema/findings";

export type FindingType =
  | "latency"
  | "error_rate"
  | "throughput"
  | "dependency_latency"
  | "trace_span"
  | "bottleneck"
  | "error_group"
  | "database_query"
  | "database_n_plus_one"
  | "database_query_volume"
  | "database_error"
  | "database_latency_contribution"
  | "database_connection_pool"
  | "database_connection_wait"
  | "database_batch"
  | "database_dependency_degradation"
  | "database_result_set"
  | "database_timeout"
  | "database_lock_contention"
  | "external_dependency_degradation"
  | "redis_degradation"
  | "queue_degradation"
  | "runtime_degradation"
  | "seasonal_anomaly"
  | "change_point";

export type FindingSeverity = "warning" | "critical";

export interface DetectionWindow {
  start: Date;
  end: Date;
}

export interface DetectionFinding {
  id: string;
  projectId: string;
  serviceName: string;
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  description: string;
  observedValue: number;
  threshold: number;
  unit: string;
  window: DetectionWindow;
  evidence: DetectionEvidence[];
}

export interface SeasonalAnalysis {
  trend: number[];
  seasonal: number[];
  residual: number[];
  anomalyScores: number[];
  changePoints: number[];
}

export interface ChangePointDetectionResult {
  changePoints: number[];
  penaltyUsed: number;
  bicScore?: number;
}

export interface ServiceBucket {
  key: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  errors?: { doc_count?: number };
}

export interface EndpointBucket {
  key: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  errors?: { doc_count?: number };
  methods?: { buckets?: EndpointMethodBucket[] };
}

export interface EndpointMethodBucket {
  key: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  errors?: { doc_count?: number };
}

export interface EndpointServiceBucket {
  key: string;
  endpoints?: { buckets?: EndpointBucket[] };
}

export interface EndpointAggregations {
  services?: { buckets?: EndpointServiceBucket[] };
}

export interface DependencyBucket {
  key: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  errors?: { doc_count?: number };
  dependencyType?: { buckets?: Array<{ key: string; doc_count: number }> };
}

export interface DependencyServiceBucket {
  key: string;
  dependencies?: { buckets?: DependencyBucket[] };
}

export interface Aggregations {
  services?: { buckets?: ServiceBucket[] };
  dependencies?: { buckets?: DependencyServiceBucket[] };
}

export interface RequestSource {
  timestamp?: string;
  service?: string;
  method?: string;
  url?: string;
  duration?: number;
  statusCode?: number;
  traceId?: string;
}

export interface MetricSource {
  timestamp?: string;
  service?: string;
  name?: string;
  value?: number;
  connectionPoolName?: string;
  connectionPoolState?: string;
  attributes?: Record<string, unknown>;
}

export interface TraceSource {
  timestamp?: string;
  service?: string;
  traceId?: string;
  duration?: number;
  parentSpanId?: string;
  spanId?: string;
  name?: string;
}
