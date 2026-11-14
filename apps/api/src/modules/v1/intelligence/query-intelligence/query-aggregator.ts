import type {
  QueryExecution,
  QueryAggregation,
  QueryIdentity,
  NPlusOnePattern,
  LargeScanPattern,
} from "./query-intelligence.types";

export function aggregateQueryExecutions(
  executions: QueryExecution[],
): QueryAggregation {
  if (executions.length === 0) {
    throw new Error("Cannot aggregate empty execution list");
  }

  const queryIdentity = executions[0]?.queryIdentity;
  if (!queryIdentity) {
    throw new Error("First execution has no query identity");
  }

  const errorCount = executions.filter((e) => e.error).length;
  const errorRate = errorCount / executions.length;

  const durations = executions.map((e) => e.durationMs);
  const totalDurationMs = durations.reduce((sum, d) => sum + d, 0);
  const avgDurationMs = totalDurationMs / durations.length;

  const sortedDurations = [...durations].sort((a, b) => a - b);
  const p50Index = Math.floor(sortedDurations.length * 0.5);
  const p95Index = Math.floor(sortedDurations.length * 0.95);
  const p99Index = Math.floor(sortedDurations.length * 0.99);

  const totalRowsAffected = executions.reduce(
    (sum, e) => sum + (e.rowsAffected ?? 0),
    0,
  );
  const totalRowsScanned = executions.reduce(
    (sum, e) => sum + (e.rowsScanned ?? 0),
    0,
  );
  const totalRowsReturned = executions.reduce(
    (sum, e) => sum + (e.rowsReturned ?? 0),
    0,
  );

  const timestamps = executions.map((e) => new Date(e.timestamp).getTime());
  const firstSeenAt = new Date(Math.min(...timestamps)).toISOString();
  const lastSeenAt = new Date(Math.max(...timestamps)).toISOString();

  return {
    queryIdentity,
    executionCount: executions.length,
    totalDurationMs,
    avgDurationMs,
    p50DurationMs: sortedDurations[p50Index] ?? 0,
    p95DurationMs: sortedDurations[p95Index] ?? 0,
    p99DurationMs: sortedDurations[p99Index] ?? 0,
    errorCount,
    errorRate,
    totalRowsAffected,
    totalRowsScanned: totalRowsScanned > 0 ? totalRowsScanned : undefined,
    totalRowsReturned: totalRowsReturned > 0 ? totalRowsReturned : undefined,
    firstSeenAt,
    lastSeenAt,
  };
}

export function detectNPlusOnePattern(
  executionsByTrace: Map<string, QueryExecution[]>,
  threshold: number = 5,
): NPlusOnePattern[] {
  const patterns: NPlusOnePattern[] = [];

  for (const [traceId, traceExecutions] of executionsByTrace) {
    if (traceExecutions.length < threshold + 1) continue;

    const byFingerprint = new Map<string, QueryExecution[]>();
    for (const exec of traceExecutions) {
      const fp = exec.queryIdentity.fingerprint;
      if (!byFingerprint.has(fp)) {
        byFingerprint.set(fp, []);
      }
      byFingerprint.get(fp)!.push(exec);
    }

    for (const [fingerprint, execs] of byFingerprint) {
      if (execs.length < threshold) continue;

      const parentQuery = execs[0]?.queryIdentity;
      if (!parentQuery) continue;

      const childQueries = execs.map((e) => e.queryIdentity).filter(Boolean);

      patterns.push({
        parentQuery,
        childQueries,
        parentChildRatio: execs.length,
        traceCount: 1,
        avgQueriesPerTrace: execs.length,
        severity: execs.length >= threshold * 2 ? "critical" : "warning",
      });
    }
  }

  return patterns;
}

export function detectLargeScanPattern(
  aggregation: QueryAggregation,
  scanEfficiencyThreshold: number = 0.1,
): LargeScanPattern | undefined {
  if (!aggregation.totalRowsScanned || !aggregation.totalRowsReturned) {
    return undefined;
  }

  const avgRowsScanned = aggregation.totalRowsScanned / aggregation.executionCount;
  const avgRowsReturned = aggregation.totalRowsReturned / aggregation.executionCount;
  const scanEfficiency = avgRowsReturned / avgRowsScanned;

  if (scanEfficiency >= scanEfficiencyThreshold) return undefined;

  return {
    queryIdentity: aggregation.queryIdentity,
    avgRowsScanned,
    avgRowsReturned,
    scanEfficiency,
    severity: scanEfficiency < 0.01 ? "critical" : "warning",
  };
}
