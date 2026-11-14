import {
  createTelemetryIdentity,
  fingerprintRoute,
} from "@soonwhy/shared";
import type {
  LatencyFinding,
  ThroughputFinding,
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

export function detectSlowRequests(
  requests: Array<{
    method: string;
    route: string;
    durationMs: number;
    traceId?: string;
    timestamp: string;
  }>,
  slowThresholdMs: number = 1000,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): LatencyFinding[] {
  const findings: LatencyFinding[] = [];

  for (const req of requests) {
    if (req.durationMs < slowThresholdMs) continue;

    const severity =
      req.durationMs >= slowThresholdMs * 2 ? "critical" : "warning";

    const identity = createTelemetryIdentity({
      domain: "performance",
      operationName: `${req.method} ${req.route}`,
      resourceName: req.route,
    });

    findings.push({
      identity,
      metric: "latency",
      observedValue: req.durationMs,
      unit: "ms",
      severity,
      reason: `Request exceeded slow threshold of ${slowThresholdMs}ms.`,
      detectedAt: req.timestamp,
      evidence: {
        window: {
          start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        samples: 1,
      },
      resourceName: req.route,
    });
  }

  return findings;
}

export function detectThroughputDegradation(
  observedRequests: number,
  baseline: { value: number; samples: number } | undefined,
  method: string,
  route: string,
  serviceName?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): ThroughputFinding | undefined {
  if (!Number.isFinite(observedRequests) || observedRequests < 0)
    return undefined;
  if (
    !baseline ||
    !Number.isFinite(baseline.value) ||
    baseline.value <= 0 ||
    baseline.samples < config.minimumSamples
  )
    return undefined;

  const change = (observedRequests - baseline.value) / baseline.value;
  const decrease = -change;

  if (decrease < config.throughputWarningDecrease) return undefined;

  const severity =
    decrease >= config.throughputCriticalDecrease ? "critical" : "warning";

  const identity = createTelemetryIdentity({
    domain: "performance",
    serviceName,
    operationName: `${method} ${route}`,
    resourceName: route,
  });

  return {
    identity,
    metric: "throughput",
    observedValue: observedRequests,
    unit: "requests",
    baselineValue: baseline.value,
    changePercent: change * 100,
    severity,
    reason:
      "Request throughput dropped materially against the comparable baseline.",
    detectedAt: new Date().toISOString(),
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: baseline.samples,
    },
    ...(serviceName ? { serviceName } : {}),
    endpoint: `${method} ${route}`,
  };
}
