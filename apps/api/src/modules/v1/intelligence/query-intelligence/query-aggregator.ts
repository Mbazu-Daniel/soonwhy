import type {
  QueryExecution,
  QueryAggregation,
  QueryIdentity,
  NPlusOnePattern,
  LargeScanPattern,
} from "./query-intelligence.types";

/**
 * Aggregate query executions into summary statistics.
 *
 * Computes:
 * - Execution count
 * - Duration statistics (avg, p50, p95, p99)
 * - Error rate
 * - Row counts (affected, scanned, returned)
 * - Time window (first/last seen)
 */
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

  // Count errors
  const errorCount = executions.filter((e) => e.error).length;
  const errorRate = errorCount / executions.length;

  // Aggregate durations
  const durations = executions.map((e) => e.durationMs);
  const totalDurationMs = durations.reduce((sum, d) => sum + d, 0);
  const avgDurationMs = totalDurationMs / durations.length;

  const sortedDurations = [...durations].sort((a, b) => a - b);
  const p50Index = Math.floor(sortedDurations.length * 0.5);
  const p95Index = Math.floor(sortedDurations.length * 0.95);
  const p99Index = Math.floor(sortedDurations.length * 0.99);

  // Aggregate row counts
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

  // Time window
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

/**
 * Detect N+1 query pattern.
 *
 * Identifies when a parent query is followed by multiple similar child queries
 * within the same trace, indicating a potential N+1 problem.
 */
export function detectNPlusOnePattern(
  executionsByTrace: Map<string, QueryExecution[]>,
  threshold: number = 5,
): NPlusOnePattern[] {
  const patterns: NPlusOnePattern[] = [];

  for (const [traceId, traceExecutions] of executionsByTrace) {
    if (traceExecutions.length < threshold + 1) continue;

    // Group by query fingerprint
    const byFingerprint = new Map<string, QueryExecution[]>();
    for (const exec of traceExecutions) {
      const fp = exec.queryIdentity.fingerprint;
      if (!byFingerprint.has(fp)) {
        byFingerprint.set(fp, []);
      }
      byFingerprint.get(fp)!.push(exec);
    }

    // Find queries with multiple executions
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

/**
 * Detect large scan patterns.
 *
 * Identifies queries that scan many more rows than they return,
 * indicating inefficient queries or missing indexes.
 */
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
