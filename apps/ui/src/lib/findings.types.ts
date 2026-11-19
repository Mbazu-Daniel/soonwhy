export type FindingType =
  | 'latency' | 'error_rate' | 'throughput' | 'dependency_latency' | 'trace_span' | 'bottleneck' | 'error_group'
  | 'database_query' | 'database_n_plus_one' | 'database_query_volume' | 'database_error'
  | 'database_latency_contribution' | 'database_connection_pool' | 'database_timeout' | 'database_result_set'
  | 'database_connection_wait' | 'database_batch' | 'database_dependency_degradation'
  | 'external_dependency_degradation' | 'redis_degradation' | 'queue_degradation' | 'runtime_degradation'
  | 'database_lock_contention' | 'seasonal_anomaly' | 'change_point' | 'performance';

export type FindingStatus = 'open' | 'resolved' | 'ignored';
export type FindingCategory = 'error' | 'performance' | 'security' | 'vulnerability';

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
  category: FindingCategory;
  status: FindingStatus;
  occurrences: number;
  lastSeenAt: string;
  resolvedAt: string | null;
  recommendation: string | null;
}

export interface ReportFinding {
  id: string;
  title: string;
  serviceName: string;
  category: FindingCategory;
  severity: string;
  occurrences: number;
  lastSeenAt: string;
  resolvedAt: string | null;
  recommendation: string | null;
}

export interface FindingReport {
  period: { from: string; to: string };
  totals: { open: number; openCritical: number; ignored: number; newInPeriod: number; resolvedInPeriod: number };
  byCategory: Array<{ category: FindingCategory; open: number; resolved: number; ignored: number }>;
  topOpen: ReportFinding[];
  resolved: ReportFinding[];
  services: Array<{ serviceName: string; open: number }>;
  markdown: string;
}
