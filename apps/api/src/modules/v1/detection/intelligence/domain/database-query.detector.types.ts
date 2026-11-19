import { fingerprintQuery } from "./query-fingerprint";
import { type DatabaseQuerySignal } from "./database-query.engine.types";

export interface DatabaseQueryTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  duration: number;
  statusCode?: number;
  statusMessage?: string;
  dependencyType: string;
  dependencyName: string;
  spanName?: string;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
  dbReturnedRows?: number;
  dbResponseBytes?: number;
  dbBatchSize?: number;
  httpRoute?: string;
  endpoint?: string;
  errorType?: string;
}

export interface DatabaseQueryCandidate {
  serviceName: string;
  signal: DatabaseQuerySignal;
  identity: ReturnType<typeof fingerprintQuery>["identity"];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  samples: DatabaseQueryTrace[];
}
