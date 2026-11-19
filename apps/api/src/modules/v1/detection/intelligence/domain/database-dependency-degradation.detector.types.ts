export interface DatabaseDependencyTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  dependencyType: string;
  dependencyName: string;
  statusCode?: number;
  errorType?: string;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbBatchSize?: number;
}

export interface DatabaseDependencySignal {
  sampleCount: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  errorCount: number;
  errorRate: number;
  p95DurationChangePercent?: number;
  poolPressure: boolean;
  connectionWaitPressure: boolean;
  batchOperationCount: number;
  batchRate: number;
  averageBatchSize?: number;
  queryFingerprintCount: number;
  degradationSignals: string[];
  confidence: "medium" | "high";
}

export interface DatabaseDependencyCandidate {
  serviceName: string;
  dependencyName: string;
  databaseSystem?: string;
  signal: DatabaseDependencySignal;
  samples: DatabaseDependencyTrace[];
  recommendation: string;
}
