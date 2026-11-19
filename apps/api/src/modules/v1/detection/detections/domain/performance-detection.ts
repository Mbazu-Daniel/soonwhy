import { evaluatePerformance } from "../../intelligence/domain/performance-intelligence";
import { type PerformanceFinding } from "../../intelligence/domain/performance-intelligence.types";
import type { EndpointPerformanceStat } from "./performance-detection.types";

export function evaluateEndpointPerformance(
  current: EndpointPerformanceStat,
  baseline?: EndpointPerformanceStat,
  thresholds: Record<string, number | undefined> = {},
): PerformanceFinding | null {
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
  }, thresholds);
}
