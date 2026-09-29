import { fingerprintQuery } from './query-fingerprint';

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
  identity: ReturnType<typeof fingerprintQuery>['identity'];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  samples: DatabaseTimeoutTrace[];
}

const MINIMUM_TIMEOUTS = 3;
const MINIMUM_TIMEOUT_RATE = 0.1;

export function detectDatabaseTimeouts(
  samples: DatabaseTimeoutTrace[],
): DatabaseTimeoutCandidate[] {
  const groups = new Map<string, DatabaseTimeoutTrace[]>();

  for (const sample of samples) {
    if (
      sample.dependencyType !== 'database' ||
      !sample.service ||
      !Number.isFinite(sample.duration) ||
      sample.duration < 0 ||
      !isTimeout(sample.errorType)
    ) continue;

    const query = sample.dbQueryText ?? sample.dbQuerySummary ?? sample.dbOperationName ?? sample.dependencyName;
    if (!query) continue;

    const identity = fingerprintQuery(query, sample.dbSystemName).identity;
    const key = sample.service + '\\0' + identity.fingerprint + '\\0' + identity.fingerprintVersion + '\\0' + (sample.dbSystemName ?? '');
    const existing = groups.get(key) ?? [];
    existing.push(sample);
    groups.set(key, existing);
  }

  const totalGroups = new Map<string, number>();
  for (const sample of samples) {
    if (sample.dependencyType !== 'database' || !sample.service) continue;
    const query = sample.dbQueryText ?? sample.dbQuerySummary ?? sample.dbOperationName ?? sample.dependencyName;
    if (!query) continue;
    const identity = fingerprintQuery(query, sample.dbSystemName).identity;
    const key = sample.service + '\\0' + identity.fingerprint + '\\0' + identity.fingerprintVersion + '\\0' + (sample.dbSystemName ?? '');
    totalGroups.set(key, (totalGroups.get(key) ?? 0) + 1);
  }

  return Array.from(groups.entries()).flatMap(([key, timeoutSamples]) => {
    const timeoutCount = timeoutSamples.length;
    const totalCount = totalGroups.get(key) ?? timeoutCount;
    const timeoutRate = totalCount > 0 ? timeoutCount / totalCount : 0;
    if (timeoutCount < MINIMUM_TIMEOUTS || timeoutRate < MINIMUM_TIMEOUT_RATE) return [];

    const first = timeoutSamples[0];
    if (!first) return [];
    const query = first.dbQueryText ?? first.dbQuerySummary ?? first.dbOperationName ?? first.dependencyName;
    if (!query) return [];
    const identity = fingerprintQuery(query, first.dbSystemName).identity;

    return [{
      serviceName: first.service,
      signal: { timeoutCount, totalCount, timeoutRate },
      identity,
      query,
      ...(first.dbQuerySummary ? { querySummary: first.dbQuerySummary } : {}),
      ...(first.dbOperationName ? { queryOperation: first.dbOperationName } : {}),
      ...(first.dbSystemName ? { databaseSystem: first.dbSystemName } : {}),
      samples: timeoutSamples.slice(0, 10),
    }];
  }).sort((left, right) => right.signal.timeoutRate - left.signal.timeoutRate).slice(0, 100);
}

function isTimeout(errorType: string | undefined): boolean {
  return typeof errorType === 'string' && (
    errorType.trim().toLowerCase() === 'timeout' ||
    errorType.trim().toLowerCase().endsWith('.timeout')
  );
}
