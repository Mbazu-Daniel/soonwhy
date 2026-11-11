import {
  createTelemetryIdentity,
  fingerprintRoute,
} from "@soonwhy/shared";
import type {
  LatencyFinding,
  PerformanceBaseline,
  PerformanceDetectionConfig,
} from "./performance-detection.types";

const DEFAULT_CONFIG: PerformanceDetectionConfig = {
  minimumSamples: 20,
  latencyWarningAbsoluteMs: 250,
  latencyWarningRelative: 0.5,
  latencyCriticalRelative: 1,
  throughputWarningDecrease: 0.3,
  throughputCriticalDecrease: 0.5,
  spanWarningContribution: 0.5,
  spanCriticalContribution: 0.75,
  cpuWarningThreshold: 70,
  cpuCriticalThreshold: 90,
  memoryWarningThreshold: 70,
  memoryCriticalThreshold: 90,
  eventLoopWarningMs: 50,
  eventLoopCriticalMs: 100,
};

interface PercentileBaseline {
  p50: number;
  p95: number;
  p99: number;
  samples: number;
}

/**
 * Detect p50/p95/p99 percentile degradation.
 *
 * Compares observed percentiles against baseline percentiles
 * to detect shifts in the latency distribution, particularly
 * tail latency which affects user experience most.
 */
export function detectPercentileDegradation(
  observed: { p50: number; p95: number; p99: number },
  baseline: PercentileBaseline | undefined,
  method: string,
  route: string,
  serviceName?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): LatencyFinding | undefined {
  if (!baseline || baseline.samples < config.minimumSamples) {
    return undefined;
  }

  // Check p95 degradation (most sensitive to tail latency)
  const p95Change = (observed.p95 - baseline.p95) / baseline.p95;
  if (p95Change < config.latencyWarningRelative) return undefined;

  const severity =
    p95Change >= config.latencyCriticalRelative ? "critical" : "warning";

  const identity = createTelemetryIdentity({
    domain: "performance",
    serviceName,
    operationName: `${method} ${route}`,
    resourceName: route,
  });

  return {
    identity,
    metric: "latency",
    observedValue: observed.p95,
    unit: "ms",
    baselineValue: baseline.p95,
    changePercent: p95Change * 100,
    severity,
    reason: `p95 latency increased from ${baseline.p95}ms to ${observed.p95}ms (${(p95Change * 100).toFixed(1)}%).`,
    detectedAt: new Date().toISOString(),
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: baseline.samples,
      percentiles: observed,
    },
    percentile: "p95",
    ...(serviceName ? { serviceName } : {}),
    resourceName: route,
  };
}

/**
 * Calculate percentiles from a sample array.
 */
export function calculatePercentiles(
  values: number[],
): { p50: number; p95: number; p99: number } {
  if (values.length === 0) {
    return { p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);

  const p50Index = Math.floor(sorted.length * 0.5);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);

  return {
    p50: sorted[p50Index] ?? 0,
    p95: sorted[p95Index] ?? 0,
    p99: sorted[p99Index] ?? 0,
  };
}
