import { fingerprintQuery } from "./query-fingerprint";

export interface DatabaseBatchTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  traceDuration?: number;
  dependencyType: string;
  dependencyName: string;
  batchSize?: number;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
  endpoint?: string;
}

export interface DatabaseBatchSignal {
  sampleCount: number;
  batchOperationCount: number;
  logicalOperationCount: number;
  averageBatchSize: number;
  p50BatchSize: number;
  p95BatchSize: number;
  p99BatchSize: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  p95BatchSizeChangePercent?: number;
  p99BatchSizeChangePercent?: number;
  p95DurationChangePercent?: number;
  p99DurationChangePercent?: number;
  p95TraceContributionPercent?: number;
  p99TraceContributionPercent?: number;
  baselineSampleCount?: number;
  regressionDetected: boolean;
  traceContributionDetected: boolean;
  confidence: "low" | "medium" | "high";
  evidenceReasons: string[];
}

export interface DatabaseBatchCandidate {
  serviceName: string;
  signal: DatabaseBatchSignal;
  identity: ReturnType<typeof fingerprintQuery>["identity"];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  endpoint?: string;
  samples: DatabaseBatchTrace[];
  recommendation: {
    action: "benchmark" | "review-batch-shape" | "preserve-batching";
    guidance: string;
    validation: string;
  };
}
