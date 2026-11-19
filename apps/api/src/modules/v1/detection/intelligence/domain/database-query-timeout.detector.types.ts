import { fingerprintQuery } from "./query-fingerprint";

export interface DatabaseQueryTimeoutTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  dependencyType: string;
  dependencyName: string;
  statusCode?: number;
  errorType?: string;
  errorMessage?: string;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
}

export interface DatabaseQueryTimeoutThresholds {
  minimumOccurrences: number;
  minimumDurationMs: number;
  minimumRatio: number;
}

export interface DatabaseQueryTimeoutSignal {
  occurrences: number;
  totalDurationMs: number;
  timeoutRatio: number;
}

export interface DatabaseQueryTimeoutCandidate {
  serviceName: string;
  identity: ReturnType<typeof fingerprintQuery>["identity"];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  signal: DatabaseQueryTimeoutSignal;
  samples: DatabaseQueryTimeoutTrace[];
}
