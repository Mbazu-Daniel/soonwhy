import { evaluatePerformance, type PerformanceFinding } from '../intelligence/performance-intelligence';

export interface EndpointPerformanceStat {
  serviceName: string;
  endpointName: string;
  sampleCount: number;
  p95Duration: number;
  throughputPerMinute: number;
  errorRate: number;
}

export function evaluateEndpointPerformance(current: EndpointPerformanceStat, baseline?: EndpointPerformanceStat): PerformanceFinding | null {
  return evaluatePerformance({
    serviceName: current.serviceName,
    endpointName: current.endpointName,
    sampleCount: current.sampleCount,
    baselineSampleCount: baseline?.sampleCount,
    p95Duration: current.p95Duration,
    baselineP95Duration: baseline?.p95Duration,
    throughputPerMinute: current.throughputPerMinute,
    baselineThroughputPerMinute: baseline?.throughputPerMinute,
    errorRate: current.errorRate,
    baselineErrorRate: baseline?.errorRate,
  });
}
