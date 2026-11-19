import { fingerprintQuery } from "./query-fingerprint";

export type LockContentionSignal = "lock_error" | "lock_wait";

export interface DatabaseLockTrace {
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

export interface DatabaseLockCandidate {
  serviceName: string;
  identity: ReturnType<typeof fingerprintQuery>["identity"];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  signal: {
    sampleCount: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
    lockErrorCount: number;
    lockErrorRate: number;
    lockQueryCount: number;
    lockQueryRate: number;
    overlappingPairCount: number;
    contentionSignals: LockContentionSignal[];
    confidence: "medium" | "high";
  };
  samples: DatabaseLockTrace[];
  recommendation: string;
}
