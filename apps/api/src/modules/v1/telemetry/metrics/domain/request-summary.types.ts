export interface StatusCounts {
  _2xx: number;
  _3xx: number;
  _4xx: number;
  _5xx: number;
}

export interface RawRequestSummary {
  total: number;
  average: number;
  p50: number;
  p95: number;
  p99: number;
  status: StatusCounts;
}

export interface RequestSummary {
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  avgLatency: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  statusCodes: StatusCounts;
}

export interface ServiceRequestSummary {
  service: string;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  p95Latency: number;
}

export interface SummaryAggregation {
  latency?: { values?: Record<string, number | null> };
  average?: { value?: number | null };
  status?: { buckets?: Array<{ key: string; doc_count: number }> };
}

export interface ServiceAggregation {
  buckets?: Array<
    SummaryAggregation & { key: string; doc_count: number }
  >;
}
