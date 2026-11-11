import {
  createTelemetryIdentity,
  fingerprintQuery,
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
 * Detect database latency regression.
 *
 * Compares observed database query latency against baseline and flags
 * when database operations become slower.
 */
export function detectDatabaseLatency(
  observedMs: number,
  baseline: PerformanceBaseline | undefined,
  query: string,
  databaseSystem?: string,
  serviceName?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): LatencyFinding | undefined {
  if (!isPositiveFinite(observedMs)) return undefined;
  if (!hasBaseline(baseline, config.minimumSamples)) {
    return createFinding(
      query,
      databaseSystem,
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
    query,
    databaseSystem,
    serviceName,
    observedMs,
    severity,
    "Database latency increased materially against the comparable baseline.",
    baseline.value,
    change * 100,
  );
}

function createFinding(
  query: string,
  databaseSystem: string | undefined,
  serviceName: string | undefined,
  observedValue: number,
  severity: "warning" | "critical" | "candidate",
  reason: string,
  baselineValue: number | undefined,
  changePercent: number | undefined,
): LatencyFinding {
  const queryFingerprint = fingerprintQuery(query, databaseSystem);

  const identity = createTelemetryIdentity({
    domain: "database",
    serviceName,
    databaseSystem,
    resourceName: queryFingerprint,
    identityAttributes: {
      queryFingerprint,
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
    resourceName: queryFingerprint,
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
