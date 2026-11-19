import { fingerprintQuery } from "./query-fingerprint";

export interface DatabaseErrorTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  dependencyType: string;
  dependencyName: string;
  statusCode?: number;
  statusMessage?: string;
  errorType?: string;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
}

export interface DatabaseErrorThresholds {
  minimumErrors: number;
  minimumErrorRate: number;
}

export interface DatabaseErrorSignal {
  errorCount: number;
  totalCount: number;
  errorRate: number;
}

export interface DatabaseErrorCandidate {
  serviceName: string;
  identity: ReturnType<typeof fingerprintQuery>["identity"];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  signal: DatabaseErrorSignal;
  samples: DatabaseErrorTrace[];
}
