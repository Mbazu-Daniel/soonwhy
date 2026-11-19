import { fingerprintQuery } from "./query-fingerprint";

export interface NPlusOneTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  parentSpanId: string;
  duration: number;
  dependencyType: string;
  dependencyName: string;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
  dbBatchSize?: number;
}

export interface NPlusOneSignal {
  occurrences: number;
  totalDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
}

export interface NPlusOneCandidate {
  serviceName: string;
  traceId: string;
  parentSpanId: string;
  identity: ReturnType<typeof fingerprintQuery>["identity"];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  signal: NPlusOneSignal;
  samples: NPlusOneTrace[];
}

export interface NPlusOneThresholds {
  minimumOccurrences: number;
  minimumTotalDurationMs: number;
}
