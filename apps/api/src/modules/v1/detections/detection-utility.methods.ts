// Utility methods extracted from detection.service.ts

export function getPercentile(
  bucket: { latency: { values: { [key: string]: number } } },
  percentile: string,
): number {
  const value = bucket.latency?.values?.[percentile] ?? 0;
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function getLatency(bucket: {
  latency: { values: { [key: string]: number } };
}): number {
  return getPercentile(bucket, "95.0");
}

export function getErrorRate(bucket: {
  errors: { doc_count: number };
  doc_count: number;
}): number {
  const errors = bucket.errors?.doc_count ?? 0;
  return bucket.doc_count ? (errors / bucket.doc_count) * 100 : 0;
}

export function metricString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function dependencyRecommendation(dependencyType: string): string {
  switch (dependencyType) {
    case "database":
      return "Inspect the query shape and database plan first. Check for N+1 queries, missing indexes, excessive reads or selected fields, offset pagination, and repeated queries. Use EXPLAIN ANALYZE before changing the query or schema.";
    case "http":
      return "Inspect downstream latency, request payload size, retries, timeouts, and connection reuse. Avoid retry amplification and reduce unnecessary payload or downstream calls where possible.";
    case "rpc":
      return "Inspect downstream RPC latency, retry behavior, timeouts, connection reuse, and whether multiple calls can be batched or avoided.";
    default:
      return "Inspect the downstream operation and trace its latency contribution before changing the caller. Check for repeated calls, unnecessary work, and connection or pooling issues.";
  }
}
