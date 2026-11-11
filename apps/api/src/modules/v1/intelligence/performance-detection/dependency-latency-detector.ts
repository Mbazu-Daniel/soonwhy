import {
  createTelemetryIdentity,
  fingerprintDependency,
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

/**
 * Detect external dependency latency regression.
 *
 * Compares observed HTTP/gRPC/Redis dependency latency against baseline
 * and flags when external services become slower.
 */
export function detectDependencyLatency(
  observedMs: number,
  baseline: PerformanceBaseline | undefined,
  dependencyType: "http" | "grpc" | "redis" | "kafka" | "nats",
  target: string,
  operation?: string,
  serviceName?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): LatencyFinding | undefined {
  if (!isPositiveFinite(observedMs)) return undefined;
  if (!hasBaseline(baseline, config.minimumSamples)) {
    return createFinding(
      dependencyType,
      target,
      operation,
      serviceName,
      observedMs,
      "candidate",
      "No sufficiently sampled comparable baseline is available.",
      undefined,
      undefined,
    );
  }

  const change = (observedMs - baseline.value) / baseline.value;
  const absoluteIncrease = observedMs - baseline.value;

  if (
    absoluteIncrease < config.latencyWarningAbsoluteMs ||
    change < config.latencyWarningRelative
  ) {
    return undefined;
  }

  const severity =
    change >= config.latencyCriticalRelative ? "critical" : "warning";

  return createFinding(
    dependencyType,
    target,
    operation,
    serviceName,
    observedMs,
    severity,
    "Dependency latency increased materially against the comparable baseline.",
    baseline.value,
    change * 100,
  );
}

/**
 * Detect internal service latency regression.
 *
 * Compares observed internal service call latency against baseline
 * and flags when internal microservices become slower.
 */
export function detectInternalServiceLatency(
  observedMs: number,
  baseline: PerformanceBaseline | undefined,
  targetService: string,
  operation?: string,
  callingService?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): LatencyFinding | undefined {
  return detectDependencyLatency(
    observedMs,
    baseline,
    "http",
    targetService,
    operation,
    callingService,
    config,
  );
}

function createFinding(
  dependencyType: "http" | "grpc" | "redis" | "kafka" | "nats",
  target: string,
  operation: string | undefined,
  serviceName: string | undefined,
  observedValue: number,
  severity: "warning" | "critical" | "candidate",
  reason: string,
  baselineValue: number | undefined,
  changePercent: number | undefined,
): LatencyFinding {
  const identity = createTelemetryIdentity({
    domain: "dependency",
    serviceName,
    operationName: operation,
    resourceName: target,
    identityAttributes: {
      dependencyType,
      target,
    },
  });

  return {
    identity,
    metric: "latency",
    observedValue,
    unit: "ms",
    baselineValue,
    changePercent,
    severity,
    reason,
    detectedAt: new Date().toISOString(),
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: baselineValue ? 20 : 0,
    },
    ...(serviceName ? { serviceName } : {}),
    resourceName: target,
  };
}

function hasBaseline(
  baseline: PerformanceBaseline | undefined,
  minimumSamples: number,
): baseline is PerformanceBaseline {
  return (
    baseline !== undefined &&
    Number.isFinite(baseline.value) &&
    baseline.value >= 0 &&
    Number.isFinite(baseline.samples) &&
    baseline.samples >= minimumSamples
  );
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
