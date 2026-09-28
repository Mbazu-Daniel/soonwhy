import { fingerprintQuery } from './query-fingerprint';

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
  identity: ReturnType<typeof fingerprintQuery>['identity'];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  signal: DatabaseQueryVolumeSignal;
  samples: DatabaseQueryVolumeTrace[];
}

export const DEFAULT_DATABASE_QUERY_VOLUME_THRESHOLDS: DatabaseQueryVolumeThresholds = {
  minimumBaselineSamples: 20,
  minimumCurrentSamples: 20,
  minimumAbsoluteIncrease: 20,
  minimumRelativeIncrease: 1,
};

export function detectDatabaseQueryVolume(
  current: DatabaseQueryVolumeTrace[],
  baseline: DatabaseQueryVolumeTrace[],
  thresholds: DatabaseQueryVolumeThresholds = DEFAULT_DATABASE_QUERY_VOLUME_THRESHOLDS,
): DatabaseQueryVolumeCandidate[] {
  const currentGroups = groupQueries(current);
  const baselineGroups = groupQueries(baseline);
  const candidates: DatabaseQueryVolumeCandidate[] = [];

  for (const [key, currentSamples] of currentGroups) {
    const baselineSamples = baselineGroups.get(key) ?? [];
    if (
      currentSamples.length < thresholds.minimumCurrentSamples ||
      baselineSamples.length < thresholds.minimumBaselineSamples
    ) continue;

    const absoluteIncrease = currentSamples.length - baselineSamples.length;
    const relativeIncrease = absoluteIncrease / baselineSamples.length;

    if (
      absoluteIncrease < thresholds.minimumAbsoluteIncrease ||
      relativeIncrease < thresholds.minimumRelativeIncrease
    ) continue;

    const first = currentSamples[0];
    if (!first) continue;

    const query = first.dbQueryText ?? first.dbQuerySummary ?? first.dbOperationName;
    if (!query) continue;

    const identity = fingerprintQuery(query, first.dbSystemName).identity;

    candidates.push({
      serviceName: first.service,
      identity,
      query,
      ...(first.dbQuerySummary ? { querySummary: first.dbQuerySummary } : {}),
      ...(first.dbOperationName ? { queryOperation: first.dbOperationName } : {}),
      ...(first.dbSystemName ? { databaseSystem: first.dbSystemName } : {}),
      ...(first.dbCollectionName ? { collectionName: first.dbCollectionName } : {}),
      signal: {
        currentCount: currentSamples.length,
        baselineCount: baselineSamples.length,
        absoluteIncrease,
        relativeIncrease,
      },
      samples: currentSamples.slice(0, 10),
    });
  }

  return candidates
    .sort((left, right) => right.signal.absoluteIncrease - left.signal.absoluteIncrease)
    .slice(0, 100);
}

function groupQueries(samples: DatabaseQueryVolumeTrace[]): Map<string, DatabaseQueryVolumeTrace[]> {
  const groups = new Map<string, DatabaseQueryVolumeTrace[]>();

  for (const sample of samples) {
    if (
      sample.dependencyType !== 'database' ||
      !Number.isFinite(sample.duration) ||
      sample.duration <= 0
    ) continue;

    const query = sample.dbQueryText ?? sample.dbQuerySummary ?? sample.dbOperationName;
    if (!query) continue;

    const identity = fingerprintQuery(query, sample.dbSystemName).identity;
    const key = sample.service + '\0' + identity.fingerprint;
    const existing = groups.get(key) ?? [];
    existing.push(sample);
    groups.set(key, existing);
  }

  return groups;
}
