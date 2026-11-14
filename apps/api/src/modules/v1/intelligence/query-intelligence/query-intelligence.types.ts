import type { TelemetryIdentity } from "../telemetry-identity.types";

export interface QueryIdentity {
  fingerprint: string;
  fingerprintVersion: number;
  databaseSystem?: string;
  operation: string;
  normalizedQuery: string;
}

export interface QueryEvidence {
  rawQuery: string;
  listCardinalities: number[];
  parameterCount: number;
  tableNames: string[];
  estimatedCardinality: "low" | "medium" | "high";
}

export interface QueryExecution {
  queryIdentity: QueryIdentity;
  durationMs: number;
  rowsAffected?: number;
  rowsScanned?: number;
  rowsReturned?: number;
  timestamp: string;
  error?: string;
  traceId?: string;
  spanId?: string;
}

export interface QueryAggregation {
  queryIdentity: QueryIdentity;
  executionCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  errorCount: number;
  errorRate: number;
  totalRowsAffected: number;
  totalRowsScanned?: number;
  totalRowsReturned?: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface QueryRegression {
  queryIdentity: QueryIdentity;
  currentAggregation: QueryAggregation;
  baselineAggregation: QueryAggregation;
  latencyChangePercent: number;
  errorRateChangePercent: number;
  frequencyChangePercent: number;
  severity: "warning" | "critical";
  detectedAt: string;
}

export interface NPlusOnePattern {
  parentQuery: QueryIdentity;
  childQueries: QueryIdentity[];
  parentChildRatio: number;
  traceCount: number;
  avgQueriesPerTrace: number;
  severity: "warning" | "critical";
}

export interface LargeScanPattern {
  queryIdentity: QueryIdentity;
  avgRowsScanned: number;
  avgRowsReturned: number;
  scanEfficiency: number;
  severity: "warning" | "critical";
}
