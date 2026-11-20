import type { MetricsBucket } from "../../telemetry/metrics/domain/metrics.repository.types";

const COUNT_METRICS = new Set(["http.server.request.count"]);

function isCountMetric(metric: string): boolean {
  return COUNT_METRICS.has(metric);
}

export function metricValues(
  metric: string,
  latest: MetricsBucket | undefined,
): Record<string, unknown> {
  if (!latest) return isCountMetric(metric) ? { value: 0, requestCount: 0 } : {};
  switch (metric) {
    case "http.server.request.duration.p50":
      return { value: latest.p50, p50: latest.p50 };
    case "http.server.request.duration.p99":
      return { value: latest.p99, p99: latest.p99 };
    case "http.server.request.errors.rate": {
      const total = (latest._2xx ?? 0) + (latest._3xx ?? 0) + (latest._4xx ?? 0) + (latest._5xx ?? 0);
      const errors = (latest._4xx ?? 0) + (latest._5xx ?? 0);
      const value = total ? (errors / total) * 100 : 0;
      return { value, errorRate: value };
    }
    case "http.server.request.count":
      return { value: latest.count, requestCount: latest.count };
    case "http.server.request.duration.p95":
    default:
      return { value: latest.p95, p95: latest.p95 };
  }
}

export function hostSampleValues(count: number): Record<string, unknown> {
  return { value: count, sampleCount: count };
}

export function atMetricPath(metric: string, values: Record<string, unknown>): Record<string, unknown> {
  if (!("value" in values)) return values;
  const nested = metric
    .split(".")
    .reverse()
    .reduce<unknown>((inner, key) => ({ [key]: inner }), values.value) as Record<string, unknown>;
  return { ...values, ...nested };
}
