export interface MetricsBucket {
  _2xx?: number;
  _3xx?: number;
  _4xx?: number;
  _5xx?: number;
}

export interface QueryMetricsInput {
  orgId: string;
  projectId: string;
  from: string;
  to: string;
  interval: string;
  service: string;
}

export class MetricsRepository {
  async queryMetrics(input: QueryMetricsInput): Promise<MetricsBucket[]> {
    return [];
  }
}
