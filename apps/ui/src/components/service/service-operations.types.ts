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
