export type MetricPercentiles = {
  metricName: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
};

export type HistogramSource = {
  histogramExplicitBounds?: number[];
  histogramBucketCounts?: number[];
  summaryQuantiles?: Array<{ quantile: number; value: number }>;
  summaryCount?: number;
};

export type MetricPercentileQuery = {
  orgId: string;
  projectId: string;
  metricName: string;
  from: string;
  to: string;
  service?: string;
};
