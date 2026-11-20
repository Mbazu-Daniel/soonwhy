import type { MetricPresentation } from "./alert-message.types";

export const METRIC_PRESENTATION: Record<string, MetricPresentation> = {
  "http.server.request.errors.rate": { label: "Error rate", unit: "%", decimals: 1 },
  "http.server.request.duration.p50": { label: "Median latency (p50)", unit: " ms", decimals: 0 },
  "http.server.request.duration.p95": { label: "Slow request latency (p95)", unit: " ms", decimals: 0 },
  "http.server.request.duration.p99": { label: "Tail latency (p99)", unit: " ms", decimals: 0 },
  "http.server.request.count": { label: "Request count", unit: " requests", decimals: 0 },
  "host.metrics.sample.count": { label: "Host samples received", unit: " samples", decimals: 0 },
};

export const OPERATOR_PHRASES: Record<string, string> = {
  gt: "is above",
  gte: "is at or above",
  lt: "is below",
  lte: "is at or below",
  eq: "equals",
  ne: "differs from",
};

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "#b91c1c",
  high: "#c2410c",
  medium: "#a16207",
  low: "#1d4ed8",
};

export const DEFAULT_SEVERITY_COLOR = "#374151";
export const DEFAULT_WINDOW_LABEL = "the last 5 minutes";
export const MAX_FAILING_ROUTES = 5;
