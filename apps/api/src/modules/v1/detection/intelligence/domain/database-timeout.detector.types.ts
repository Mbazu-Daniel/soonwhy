import { fingerprintQuery } from "./query-fingerprint";

export interface DatabaseTimeoutTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  dependencyType: string;
  dependencyName: string;
  errorType?: string;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
}

export interface DatabaseTimeoutSignal {
  timeoutCount: number;
  totalCount: number;
  timeoutRate: number;
}

export interface DatabaseTimeoutCandidate {
  serviceName: string;
  signal: DatabaseTimeoutSignal;
  identity: ReturnType<typeof fingerprintQuery>["identity"];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  samples: DatabaseTimeoutTrace[];
}
