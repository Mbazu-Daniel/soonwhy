import { fingerprintQuery } from "./query-fingerprint";

const MINIMUM_SAMPLES = 5;
const LOCK_WAIT_THRESHOLD_MS = 250;
const MINIMUM_OVERLAP_PAIRS = 2;
const MINIMUM_OVERLAP_DURATION_MS = 50;

const LOCK_ERROR_PATTERN =
  /deadlock|lock wait timeout|lock timeout|lock request time out|could not obtain lock|lock not available|database is locked|55p03|40p01/i;

const LOCK_QUERY_PATTERN =
  /\bfor\s+(?:no\s+key\s+)?update\b|\bfor\s+(?:key\s+)?share\b|\block\s+table\b|\bpg_advisory_(?:xact_)?lock\b|\bget_lock\s*\(|\bdbms_lock\b/i;

export type LockContentionSignal = "lock_error" | "lock_wait";

export interface DatabaseLockTrace {
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

export interface DatabaseLockCandidate {
  serviceName: string;
  identity: ReturnType<typeof fingerprintQuery>["identity"];
  query: string;
  querySummary?: string;
  queryOperation?: string;
  databaseSystem?: string;
  collectionName?: string;
  signal: {
    sampleCount: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
    lockErrorCount: number;
    lockErrorRate: number;
    lockQueryCount: number;
    lockQueryRate: number;
    overlappingPairCount: number;
    contentionSignals: LockContentionSignal[];
    confidence: "medium" | "high";
  };
  samples: DatabaseLockTrace[];
  recommendation: string;
}

export function detectDatabaseLockContention(
  samples: DatabaseLockTrace[],
): DatabaseLockCandidate[] {
  const groups = groupByQuery(samples);
  const candidates: DatabaseLockCandidate[] = [];

  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;

    const lockErrorSamples = group.filter(isLockError);
    const lockQuerySamples = group.filter(isLockQuery);
    const overlappingPairCount = countOverlappingPairs(lockQuerySamples);
    const durations = distribution(group.map((sample) => sample.duration));

    const contentionSignals: LockContentionSignal[] = [];
    if (lockErrorSamples.length > 0) {
      contentionSignals.push("lock_error");
    } else if (
      lockQuerySamples.length >= MINIMUM_SAMPLES &&
      durations.p95 >= LOCK_WAIT_THRESHOLD_MS &&
      overlappingPairCount >= MINIMUM_OVERLAP_PAIRS
    ) {
      contentionSignals.push("lock_wait");
    }

    if (!contentionSignals.length) continue;

    const query = queryFor(first);
    const identity = fingerprintQuery(query, first.dbSystemName).identity;

    candidates.push({
      serviceName: first.service,
      identity,
      query,
      ...(first.dbQuerySummary ? { querySummary: first.dbQuerySummary } : {}),
      ...(first.dbOperationName
        ? { queryOperation: first.dbOperationName }
        : {}),
      ...(first.dbSystemName ? { databaseSystem: first.dbSystemName } : {}),
      ...(first.dbCollectionName
        ? { collectionName: first.dbCollectionName }
        : {}),
      signal: {
        sampleCount: group.length,
        p50Duration: durations.p50,
        p95Duration: durations.p95,
        p99Duration: durations.p99,
        lockErrorCount: lockErrorSamples.length,
        lockErrorRate: lockErrorSamples.length / group.length,
        lockQueryCount: lockQuerySamples.length,
        lockQueryRate: lockQuerySamples.length / group.length,
        overlappingPairCount,
        contentionSignals,
        confidence: contentionSignals.includes("lock_error")
          ? "high"
          : "medium",
      },
      samples: group.slice(0, 10),
      recommendation: contentionSignals.includes("lock_error")
        ? "Inspect the transaction boundaries that touch the locked rows. Keep transactions short, acquire locks in a consistent order, verify the locked row is covered by an index, and retry deadlocks with jitter instead of immediate retries."
        : "Inspect the lock-acquiring query and its transaction scope. Check whether the locked rows are indexed, whether competing transactions overlap, and whether the lock can be replaced with an atomic update or a shorter critical section.",
    });
  }

  return candidates
    .sort(
      (left, right) =>
        right.signal.lockErrorCount - left.signal.lockErrorCount ||
        right.signal.p95Duration - left.signal.p95Duration,
    )
    .slice(0, 100);
}

function groupByQuery(
  samples: DatabaseLockTrace[],
): Map<string, DatabaseLockTrace[]> {
  const groups = new Map<string, DatabaseLockTrace[]>();

  for (const sample of samples) {
    if (
      sample.dependencyType !== "database" ||
      !sample.service ||
      !Number.isFinite(sample.duration) ||
      sample.duration < 0
    )
      continue;

    const query = queryFor(sample);
    if (!query) continue;

    const identity = fingerprintQuery(query, sample.dbSystemName).identity;
    const key = [
      sample.service,
      identity.fingerprintVersion,
      identity.fingerprint,
      sample.dbSystemName ?? "",
    ].join("\0");

    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }

  return groups;
}

function queryFor(sample: DatabaseLockTrace): string {
  return (
    sample.dbQueryText ??
    sample.dbQuerySummary ??
    sample.dbOperationName ??
    sample.dependencyName
  );
}

function isLockError(sample: DatabaseLockTrace): boolean {
  return (
    LOCK_ERROR_PATTERN.test(sample.errorType ?? "") ||
    LOCK_ERROR_PATTERN.test(sample.statusMessage ?? "")
  );
}

function isLockQuery(sample: DatabaseLockTrace): boolean {
  return LOCK_QUERY_PATTERN.test(sample.dbQueryText ?? "");
}

function countOverlappingPairs(samples: DatabaseLockTrace[]): number {
  const spans = samples
    .map((sample) => ({
      start: Date.parse(sample.timestamp),
      duration: sample.duration,
    }))
    .filter(
      (span) =>
        Number.isFinite(span.start) &&
        span.duration >= MINIMUM_OVERLAP_DURATION_MS,
    )
    .sort((left, right) => left.start - right.start);

  let pairs = 0;
  for (let index = 0; index < spans.length; index += 1) {
    const current = spans[index];
    if (!current) continue;
    const currentEnd = current.start + current.duration;

    for (let other = index + 1; other < spans.length; other += 1) {
      const candidate = spans[other];
      if (!candidate || candidate.start >= currentEnd) break;
      pairs += 1;
    }
  }

  return pairs;
}

function distribution(values: number[]): {
  p50: number;
  p95: number;
  p99: number;
} {
  return {
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
  };
}

function percentile(values: number[], rank: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * rank;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  return (
    (sorted[lower] ?? 0) +
    ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * (index - lower)
  );
}
