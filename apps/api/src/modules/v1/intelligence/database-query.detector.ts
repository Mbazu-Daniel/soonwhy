import { fingerprintQuery } from './query-fingerprint';
import {
  evaluateDatabaseQuery,
  percentile,
  type DatabaseQuerySignal,
} from './database-query.engine';

export interface DatabaseQueryTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  duration: number;
  dependencyType: string;
  dependencyName: string;
  spanName?: string;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
  dbReturnedRows?: number;
  dbBatchSize?: number;
}

export interface DatabaseQueryCandidate {
  serviceName: string;
  signal: DatabaseQuerySignal;
  identity: ReturnType<typeof fingerprintQuery>['identity'];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  samples: DatabaseQueryTrace[];
}

export function detectDatabaseQueries(
  current: DatabaseQueryTrace[],
  baseline: DatabaseQueryTrace[],
): DatabaseQueryCandidate[] {
  const currentGroups = groupQueries(current);
  const baselineGroups = groupQueries(baseline);
  const candidates: DatabaseQueryCandidate[] = [];

  for (const [groupKey, currentSamples] of currentGroups) {
    const separator = groupKey.indexOf('\0');
    const fingerprint = separator >= 0 ? groupKey.slice(separator + 1) : groupKey;
    const first = currentSamples[0];
    if (!first) continue;

    const query = first.dbQueryText ?? first.dbQuerySummary ?? first.dbOperationName ?? first.spanName;

    if (!query) continue;

    const identity = fingerprintQuery(query, first.dbSystemName).identity;
    if (identity.fingerprint !== fingerprint) continue;

    const observedP95 = percentile(currentSamples.map((sample) => sample.duration), 0.95);
    if (observedP95 === undefined) continue;

    const baselineSamples = baselineGroups.get(groupKey) ?? [];
    const baselineP95 = percentile(baselineSamples.map((sample) => sample.duration), 0.95);
    const signal = evaluateDatabaseQuery(
      observedP95,
      baselineP95,
      baselineSamples.length,
    );

    if (!signal) continue;

    candidates.push({
      serviceName: first.service,
      signal,
      identity,
      query,
      ...(first.dbQuerySummary ? { querySummary: first.dbQuerySummary } : {}),
      ...(first.dbOperationName ? { queryOperation: first.dbOperationName } : {}),
      ...(first.dbSystemName ? { databaseSystem: first.dbSystemName } : {}),
      ...(first.dbCollectionName ? { collectionName: first.dbCollectionName } : {}),
      samples: currentSamples.slice(0, 5),
    });
  }

  return candidates
    .sort((left, right) => right.signal.observedValue - left.signal.observedValue)
    .slice(0, 100);
}

function groupQueries(samples: DatabaseQueryTrace[]): Map<string, DatabaseQueryTrace[]> {
  const groups = new Map<string, DatabaseQueryTrace[]>();

  for (const sample of samples) {
    if (
      sample.dependencyType !== 'database' ||
      !Number.isFinite(sample.duration) ||
      sample.duration <= 0
    ) continue;

    const query = sample.dbQueryText ?? sample.dbQuerySummary ?? sample.dbOperationName ?? sample.spanName;
    if (!query) continue;

    const identity = fingerprintQuery(query, sample.dbSystemName).identity;
    const groupKey = sample.service + '\0' + identity.fingerprint;
    const existing = groups.get(groupKey) ?? [];
    existing.push(sample);
    groups.set(groupKey, existing);
  }

  return groups;
}
