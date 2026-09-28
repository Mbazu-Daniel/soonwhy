import { fingerprintQuery } from './query-fingerprint';

export interface NPlusOneTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  parentSpanId: string;
  duration: number;
  dependencyType: string;
  dependencyName: string;
  dbQueryText?: string;
  dbQuerySummary?: string;
  dbOperationName?: string;
  dbSystemName?: string;
  dbCollectionName?: string;
  dbBatchSize?: number;
}

export interface NPlusOneSignal {
  occurrences: number;
  totalDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
}

export interface NPlusOneCandidate {
  serviceName: string;
  traceId: string;
  parentSpanId: string;
  identity: ReturnType<typeof fingerprintQuery>['identity'];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  signal: NPlusOneSignal;
  samples: NPlusOneTrace[];
}

export interface NPlusOneThresholds {
  minimumOccurrences: number;
  minimumTotalDurationMs: number;
}

export const DEFAULT_N_PLUS_ONE_THRESHOLDS: NPlusOneThresholds = {
  minimumOccurrences: 3,
  minimumTotalDurationMs: 50,
};

export function detectNPlusOne(
  traces: NPlusOneTrace[],
  thresholds: NPlusOneThresholds = DEFAULT_N_PLUS_ONE_THRESHOLDS,
): NPlusOneCandidate[] {
  const groups = new Map<string, NPlusOneTrace[]>();

  for (const trace of traces) {
    if (
      trace.dependencyType !== 'database' ||
      !trace.parentSpanId ||
      !trace.traceId ||
      !Number.isFinite(trace.duration) ||
      trace.duration <= 0 ||
      (trace.dbBatchSize !== undefined && trace.dbBatchSize > 1)
    ) continue;

    const query = trace.dbQueryText ?? trace.dbQuerySummary ?? trace.dbOperationName;
    if (!query) continue;

    const identity = fingerprintQuery(query, trace.dbSystemName).identity;
    const key = [
      trace.traceId,
      trace.parentSpanId,
      identity.fingerprintVersion,
      identity.fingerprint,
    ].join('\0');

    const existing = groups.get(key) ?? [];
    existing.push(trace);
    groups.set(key, existing);
  }

  return Array.from(groups.entries())
    .flatMap(([key, samples]) => {
      if (samples.length < thresholds.minimumOccurrences) return [];

      const first = samples[0];
      if (!first) return [];

      const totalDurationMs = samples.reduce((total, sample) => total + sample.duration, 0);
      if (totalDurationMs < thresholds.minimumTotalDurationMs) return [];

      const query = first.dbQueryText ?? first.dbQuerySummary ?? first.dbOperationName;
      if (!query) return [];

      const identity = fingerprintQuery(query, first.dbSystemName).identity;
      const durations = samples.map((sample) => sample.duration);
      const p50DurationMs = percentile(durations, 0.5);
      const p95DurationMs = percentile(durations, 0.95);
      if (p50DurationMs === undefined || p95DurationMs === undefined) return [];

      return [{
        serviceName: first.service,
        traceId: first.traceId,
        parentSpanId: first.parentSpanId,
        identity,
        query,
        ...(first.dbQuerySummary ? { querySummary: first.dbQuerySummary } : {}),
        ...(first.dbOperationName ? { queryOperation: first.dbOperationName } : {}),
        ...(first.dbSystemName ? { databaseSystem: first.dbSystemName } : {}),
        ...(first.dbCollectionName ? { collectionName: first.dbCollectionName } : {}),
        signal: {
          occurrences: samples.length,
          totalDurationMs,
          p50DurationMs,
          p95DurationMs,
        },
        samples: samples.slice(0, 10),
      }];
    })
    .sort((left, right) => right.signal.totalDurationMs - left.signal.totalDurationMs)
    .slice(0, 100);
}

function percentile(values: number[], rank: number): number | undefined {
  const finite = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!finite.length) return undefined;

  const index = (finite.length - 1) * Math.min(1, Math.max(0, rank));
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return finite[lower];

  const weight = index - lower;
  return finite[lower]! + (finite[upper]! - finite[lower]!) * weight;
}
