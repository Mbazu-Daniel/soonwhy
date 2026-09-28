import { fingerprintQuery } from './query-fingerprint';

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
  identity: ReturnType<typeof fingerprintQuery>['identity'];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  signal: DatabaseErrorSignal;
  samples: DatabaseErrorTrace[];
}

export const DEFAULT_DATABASE_ERROR_THRESHOLDS: DatabaseErrorThresholds = {
  minimumErrors: 3,
  minimumErrorRate: 0.1,
};

export function detectDatabaseErrors(
  traces: DatabaseErrorTrace[],
  thresholds: DatabaseErrorThresholds = DEFAULT_DATABASE_ERROR_THRESHOLDS,
): DatabaseErrorCandidate[] {
  const groups = new Map<string, DatabaseErrorTrace[]>();

  for (const trace of traces) {
    if (
      trace.dependencyType !== 'database' ||
      !Number.isFinite(trace.duration) ||
      trace.duration < 0
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
      if (!first) return [];

      const errors = samples.filter(isDatabaseError);
      const errorRate = errors.length / samples.length;

      if (errors.length < thresholds.minimumErrors || errorRate < thresholds.minimumErrorRate) {
        return [];
      }

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
          errorCount: errors.length,
          totalCount: samples.length,
          errorRate,
        },
        samples: errors.slice(0, 10),
      }];
    })
    .sort((left, right) => right.signal.errorCount - left.signal.errorCount)
    .slice(0, 100);
}

function isDatabaseError(trace: DatabaseErrorTrace): boolean {
  return trace.statusCode !== undefined && trace.statusCode >= 2 && trace.statusCode <= 5;
}
