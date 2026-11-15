export type FindingType =
  | 'latency' | 'error_rate' | 'throughput' | 'dependency_latency' | 'trace_span' | 'bottleneck' | 'error_group'
  | 'database_query' | 'database_n_plus_one' | 'database_query_volume' | 'database_error'
  | 'database_latency_contribution' | 'database_connection_pool' | 'database_timeout' | 'database_result_set'
  | 'database_connection_wait' | 'database_batch' | 'database_dependency_degradation'
  | 'external_dependency_degradation' | 'redis_degradation' | 'queue_degradation' | 'performance';

export type FindingSeverity = 'warning' | 'critical';

export interface FindingEvidence {
  kind: string;
  label: string;
  value: number | string;
  context?: Record<string, unknown>;
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
  windowStart: string;
  windowEnd: string;
  evidence: FindingEvidence[];
}
