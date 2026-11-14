export interface OperationStats {
  name: string;
  requests: number;
  errors: number;
  errorRate: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export interface DependencyStats extends OperationStats {
  type: string;
}

export interface ServiceOperations {
  service: string;
  operations: OperationStats[];
  dependencies: DependencyStats[];
  failing: OperationStats[];
}

export interface TermBucket {
  key: string | number;
  doc_count: number;
  avg?: { value?: number | null };
  latency?: { values?: Record<string, number | null> };
  type?: { buckets?: Array<{ key: string | number }> };
}

export interface TermBuckets {
  buckets?: TermBucket[];
}
