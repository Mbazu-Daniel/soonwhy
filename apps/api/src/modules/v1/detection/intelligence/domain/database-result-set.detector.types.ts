import { fingerprintQuery } from "./query-fingerprint";

export interface DatabaseResultSetTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  traceDuration?: number;
  dependencyType: string;
  dependencyName: string;
  returnedRows?: number;
  responseBytes?: number;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
  endpoint?: string;
}

export interface DatabaseResultSetDistribution {
  p50: number;
  p95: number;
  p99: number;
}

export interface DatabaseResultSetSignal {
  sampleCount: number;
  p50ReturnedRows: number;
  p95ReturnedRows: number;
  p99ReturnedRows: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  largeResultRate: number;
  largeResultRows: number;
  current: DatabaseResultSetDistribution;
  baseline?: DatabaseResultSetDistribution;
  baselineSampleCount?: number;
  p95RowsChangePercent?: number;
  p99RowsChangePercent?: number;
  p95DurationChangePercent?: number;
  p99DurationChangePercent?: number;
  p95TraceContributionPercent?: number;
  p99TraceContributionPercent?: number;
  regressionDetected: boolean;
  confidence: "low" | "medium" | "high";
  evidenceReasons: string[];
}

export interface DatabaseResultSetCandidate {
  serviceName: string;
  signal: DatabaseResultSetSignal;
  identity: ReturnType<typeof fingerprintQuery>["identity"];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  endpoint?: string;
  payloadBytes?: DatabaseResultSetDistribution;
  samples: DatabaseResultSetTrace[];
  recommendation: {
    action:
      | "pagination"
      | "projection"
      | "bounded-query"
      | "inspect-payload"
      | "benchmark";
    guidance: string;
    validation: string;
  };
}

export interface DatabaseResultSetDetectionResult {
  candidates: DatabaseResultSetCandidate[];
  insufficientEvidence: Array<{
    serviceName: string;
    fingerprint?: string;
    reason: string;
    sampleCount: number;
  }>;
}
