export interface MetricsBucket {
  bucket: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  _2xx: number;
  _3xx: number;
  _4xx: number;
  _5xx: number;
}

export interface DateBucket {
  key_as_string?: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  status?: {
    buckets?: Array<{ key: string; doc_count: number }>;
  };
}

export interface MetricsAggregation {
  buckets?: DateBucket[];
}
