export interface RequestStat {
  url: string;
  method: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
}
