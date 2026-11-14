export interface StatusCounts { _2xx: number; _3xx: number; _4xx: number; _5xx: number; }

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

export function statusShare(status: StatusCounts, key: keyof StatusCounts): number {
  const total = status._2xx + status._3xx + status._4xx + status._5xx;
  return total ? Math.round((status[key] / total) * 100) : 0;
}
