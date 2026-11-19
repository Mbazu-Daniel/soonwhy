import { fingerprintQuery } from "./query-fingerprint";

export interface DatabaseQueryVolumeTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  dependencyType: string;
  dependencyName: string;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
  dbReturnedRows?: number;
}

export interface DatabaseQueryVolumeThresholds {
  minimumBaselineSamples: number;
  minimumCurrentSamples: number;
  minimumAbsoluteIncrease: number;
  minimumRelativeIncrease: number;
}

export interface DatabaseQueryVolumeSignal {
  currentCount: number;
  baselineCount: number;
  absoluteIncrease: number;
  relativeIncrease: number;
}

export interface DatabaseQueryVolumeCandidate {
  serviceName: string;
  identity: ReturnType<typeof fingerprintQuery>["identity"];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  signal: DatabaseQueryVolumeSignal;
  samples: DatabaseQueryVolumeTrace[];
}
