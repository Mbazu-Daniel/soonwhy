import type { ParsedResource } from "./resource";

export type MetricType =
  | "gauge"
  | "sum"
  | "histogram"
  | "exponential_histogram"
  | "summary";

export type AggregationTemporality = "unspecified" | "delta" | "cumulative";

export interface ParsedHistogram {
  count: number;
  sum: number | null;
  min: number | null;
  max: number | null;
  bucketCounts: number[];
  explicitBounds: number[];
}

export interface ParsedExponentialHistogram {
  count: number;
  sum: number | null;
  min: number | null;
  max: number | null;
  scale: number;
  zeroCount: number;
  zeroThreshold: number;
  positiveOffset: number;
  positiveBuckets: number[];
  negativeOffset: number;
  negativeBuckets: number[];
}

export interface ParsedSummary {
  count: number;
  sum: number;
  quantiles: Array<{ quantile: number; value: number }>;
}

export interface ParsedMetricPoint {
  timestamp: string;
  metricName: string;
  metricUnit: string;
  metricType: MetricType;
  value: number | null;
  valueInt: string | null;
  aggregationTemporality?: AggregationTemporality;
  histogram?: ParsedHistogram;
  exponentialHistogram?: ParsedExponentialHistogram;
  summary?: ParsedSummary;
  resource: ParsedResource;
  attributes: Record<string, unknown>;
}

export interface ParseMetricsResult {
  points: ParsedMetricPoint[];
  rejected: number;
}
