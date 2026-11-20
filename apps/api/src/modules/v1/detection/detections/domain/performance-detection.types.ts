export interface EndpointPerformanceStat {
  serviceName: string;
  endpointName: string;
  sampleCount: number;
  p95Duration: number;
  throughputPerMinute: number;
  errorRate: number;
}
