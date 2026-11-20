import { fingerprintQuery } from "./query-fingerprint";

export interface DatabaseLatencyContributionTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  traceDuration: number;
  dependencyType: string;
  dependencyName: string;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
}

export interface DatabaseLatencyContributionThresholds {
  minimumSamples: number;
  minimumP95ContributionPercent: number;
  minimumP95DurationMs: number;
}

export interface DatabaseLatencyContributionSignal {
  sampleCount: number;
  p50ContributionPercent: number;
  p95ContributionPercent: number;
  p95DurationMs: number;
}

export interface DatabaseLatencyContributionCandidate {
  serviceName: string;
  identity: ReturnType<typeof fingerprintQuery>["identity"];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  signal: DatabaseLatencyContributionSignal;
  samples: DatabaseLatencyContributionTrace[];
}
