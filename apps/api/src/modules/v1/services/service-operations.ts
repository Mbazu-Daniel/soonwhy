import type { DependencyStats, OperationStats, TermBucket, TermBuckets } from "./service-operations.types";

function round(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.round((value as number) * 100) / 100 : 0;
}

function raw(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number((value as number).toPrecision(12)) : 0;
}

function percentile(bucket: TermBucket, percent: number): number {
  const values = bucket.latency?.values ?? {};
  return raw(values[`${percent}.0`] ?? values[String(percent)]);
}

function errorCounts(errors: TermBuckets | undefined): Map<string, number> {
  return new Map((errors?.buckets ?? []).map((bucket) => [String(bucket.key), bucket.doc_count]));
}

function statsOf(bucket: TermBucket, errors: Map<string, number>): OperationStats {
  const name = String(bucket.key);
  const failed = Math.min(errors.get(name) ?? 0, bucket.doc_count);
  return {
    name,
    requests: bucket.doc_count,
    errors: failed,
    errorRate: bucket.doc_count ? round((failed / bucket.doc_count) * 100) : 0,
    avgMs: raw(bucket.avg?.value),
    p50Ms: percentile(bucket, 50),
    p95Ms: percentile(bucket, 95),
    p99Ms: percentile(bucket, 99),
  };
}

export function buildOperations(buckets: TermBuckets | undefined, errors: TermBuckets | undefined): OperationStats[] {
  const failed = errorCounts(errors);
  return (buckets?.buckets ?? [])
    .filter((bucket) => String(bucket.key) !== "")
    .map((bucket) => statsOf(bucket, failed))
    .sort((a, b) => b.requests - a.requests || a.name.localeCompare(b.name));
}

export function buildDependencies(buckets: TermBuckets | undefined, errors: TermBuckets | undefined): DependencyStats[] {
  const failed = errorCounts(errors);
  return (buckets?.buckets ?? [])
    .filter((bucket) => String(bucket.key) !== "")
    .map((bucket) => ({
      ...statsOf(bucket, failed),
      type: String(bucket.type?.buckets?.[0]?.key ?? "unknown"),
    }))
    .sort((a, b) => b.requests - a.requests || a.name.localeCompare(b.name));
}

export function failingOperations(operations: OperationStats[], limit = 10): OperationStats[] {
  return operations
    .filter((operation) => operation.errors > 0)
    .sort((a, b) => b.errors - a.errors || b.errorRate - a.errorRate)
    .slice(0, limit);
}
