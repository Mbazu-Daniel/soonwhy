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

function significantFigures(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toPrecision(2));
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
    avgLatency: significantFigures(raw.average),
    latencyP50: significantFigures(raw.p50),
    latencyP95: significantFigures(raw.p95),
    latencyP99: significantFigures(raw.p99),
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

export function spanStatusCounts(
  total: number,
  failed: number,
  aggregation: SummaryAggregation,
): StatusCounts {
  const classes = statusCountsOf(aggregation);
  const clientErrors = Math.min(classes._4xx, failed, total);
  const serverErrors = Math.max(0, Math.min(failed, total) - clientErrors);
  const redirects = Math.min(classes._3xx, Math.max(0, total - clientErrors - serverErrors));
  return {
    _2xx: Math.max(0, total - redirects - clientErrors - serverErrors),
    _3xx: redirects,
    _4xx: clientErrors,
    _5xx: serverErrors,
  };
}
