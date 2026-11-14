import {
  HEALTH_ERROR_WEIGHT,
  HEALTH_LATENCY_DIVISOR,
} from "./request-summary.constants";
import type {
  RawRequestSummary,
  RequestSummary,
  StatusCounts,
  SummaryAggregation,
} from "./request-summary.types";

export function errorCountOf(status: StatusCounts): number {
  return status._4xx + status._5xx;
}

export function errorRateOf(errors: number, total: number): number {
  return total ? Math.round((errors / total) * 10000) / 100 : 0;
}

export function statusCountsOf(aggregation: SummaryAggregation): StatusCounts {
  const counts = new Map(
    (aggregation.status?.buckets ?? []).map((bucket) => [bucket.key, bucket.doc_count]),
  );
  return {
    _2xx: counts.get("2xx") ?? 0,
    _3xx: counts.get("3xx") ?? 0,
    _4xx: counts.get("4xx") ?? 0,
    _5xx: counts.get("5xx") ?? 0,
  };
}

export function percentileOf(aggregation: SummaryAggregation, percent: number): number {
  return aggregation.latency?.values?.[`${percent}.0`] ?? 0;
}

export function summarize(raw: RawRequestSummary): RequestSummary {
  const errorCount = errorCountOf(raw.status);
  return {
    totalRequests: raw.total,
    errorCount,
    errorRate: errorRateOf(errorCount, raw.total),
    avgLatency: Math.round(raw.average),
    latencyP50: Math.round(raw.p50),
    latencyP95: Math.round(raw.p95),
    latencyP99: Math.round(raw.p99),
    statusCodes: raw.status,
  };
}

export function healthScore(summary: RequestSummary): number {
  if (!summary.totalRequests) return 0;
  const penalty =
    summary.errorRate * HEALTH_ERROR_WEIGHT + summary.latencyP95 / HEALTH_LATENCY_DIVISOR;
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export function summaryInterval(rangeMs: number): "5m" | "1h" | "1d" {
  if (rangeMs <= 6 * 3_600_000) return "5m";
  if (rangeMs <= 48 * 3_600_000) return "1h";
  return "1d";
}
