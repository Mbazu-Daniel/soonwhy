import { fingerprintQuery } from './query-fingerprint';

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
  identity: ReturnType<typeof fingerprintQuery>['identity'];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  signal: DatabaseQueryTimeoutSignal;
  samples: DatabaseQueryTimeoutTrace[];
}

export const DEFAULT_DATABASE_QUERY_TIMEOUT_THRESHOLDS: DatabaseQueryTimeoutThresholds = {
  minimumOccurrences: 2,
  minimumDurationMs: 5_000,
  minimumRatio: 0.5,
};

export function detectDatabaseQueryTimeouts(
  traces: DatabaseQueryTimeoutTrace[],
  thresholds: DatabaseQueryTimeoutThresholds = DEFAULT_DATABASE_QUERY_TIMEOUT_THRESHOLDS,
): DatabaseQueryTimeoutCandidate[] {
  const groups = new Map<string, DatabaseQueryTimeoutTrace[]>();

  for (const trace of traces) {
    if (
      trace.dependencyType !== 'database' ||
      !Number.isFinite(trace.duration) ||
      trace.duration < thresholds.minimumDurationMs
    ) continue;

    const query = trace.dbQueryText ?? trace.dbQuerySummary ?? trace.dbOperationName;
    if (!query) continue;

    const identity = fingerprintQuery(query, trace.dbSystemName).identity;
    const key = [
      trace.service,
      identity.fingerprintVersion,
      identity.fingerprint,
      trace.dbSystemName ?? '',
    ].join('\0');

    const existing = groups.get(key) ?? [];
    existing.push(trace);
    groups.set(key, existing);
  }

  return Array.from(groups.values())
    .flatMap((samples) => {
      const first = samples[0];
      if (!first || samples.length < thresholds.minimumOccurrences) return [];

      const timeoutRatio = samples.length / traces.filter((trace) =>
        trace.service === first.service &&
        (trace.dbSystemName ?? '') === (first.dbSystemName ?? '') &&
        (trace.dbQueryText ?? trace.dbQuerySummary ?? trace.dbOperationName) !== undefined,
      ).length;

      if (!Number.isFinite(timeoutRatio) || timeoutRatio < thresholds.minimumRatio) return [];

      const query = first.dbQueryText ?? first.dbQuerySummary ?? first.dbOperationName;
      if (!query) return [];

      return [{
        serviceName: first.service,
        identity: fingerprintQuery(query, first.dbSystemName).identity,
        query,
        ...(first.dbQuerySummary ? { querySummary: first.dbQuerySummary } : {}),
        ...(first.dbOperationName ? { queryOperation: first.dbOperationName } : {}),
        ...(first.dbSystemName ? { databaseSystem: first.dbSystemName } : {}),
        ...(first.dbCollectionName ? { collectionName: first.dbCollectionName } : {}),
        signal: {
          occurrences: samples.length,
          totalDurationMs: samples.reduce((total, sample) => total + sample.duration, 0),
          timeoutRatio,
        },
        samples: samples.slice(0, 10),
      }];
    })
    .sort((left, right) => right.signal.totalDurationMs - left.signal.totalDurationMs)
    .slice(0, 100);
}
