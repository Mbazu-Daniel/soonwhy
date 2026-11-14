import {
  createTelemetryIdentity,
  fingerprintSpan,
} from "@soonwhy/shared";
import type {
  SpanFinding,
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

export function detectSpanContribution(
  spanDurationMs: number,
  traceDurationMs: number,
  spanName: string,
  traceId?: string,
  parentSpanId?: string,
  serviceName?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): SpanFinding | undefined {
  if (
    !isPositiveFinite(spanDurationMs) ||
    !isPositiveFinite(traceDurationMs) ||
    spanDurationMs > traceDurationMs
  ) {
    return undefined;
  }

  const contribution = spanDurationMs / traceDurationMs;
  if (contribution < config.spanWarningContribution) return undefined;

  const severity =
    contribution >= config.spanCriticalContribution ? "critical" : "warning";

  const identity = createTelemetryIdentity({
    domain: "performance",
    serviceName,
    operationName: spanName,
    identityAttributes: {
      spanName,
      contribution: contribution * 100,
    },
  });

  return {
    identity,
    metric: "span_duration",
    observedValue: contribution * 100,
    unit: "%",
    severity,
    reason: `Span contributes ${(contribution * 100).toFixed(1)}% of trace duration.`,
    detectedAt: new Date().toISOString(),
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: 1,
    },
    spanName,
    traceId,
    parentSpanId,
  };
}

export function detectDatabaseTimeContribution(
  dbTimeMs: number,
  traceDurationMs: number,
  serviceName?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): SpanFinding | undefined {
  if (
    !isPositiveFinite(dbTimeMs) ||
    !isPositiveFinite(traceDurationMs) ||
    dbTimeMs > traceDurationMs
  ) {
    return undefined;
  }

  const contribution = dbTimeMs / traceDurationMs;
  if (contribution < config.spanWarningContribution) return undefined;

  const severity =
    contribution >= config.spanCriticalContribution ? "critical" : "warning";

  const identity = createTelemetryIdentity({
    domain: "performance",
    serviceName,
    operationName: "database_operations",
    identityAttributes: {
      dbTime: dbTimeMs,
      contribution: contribution * 100,
    },
  });

  return {
    identity,
    metric: "span_duration",
    observedValue: contribution * 100,
    unit: "%",
    severity,
    reason: `Database operations contribute ${(contribution * 100).toFixed(1)}% of trace duration (${dbTimeMs}ms of ${traceDurationMs}ms).`,
    detectedAt: new Date().toISOString(),
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: 1,
    },
    spanName: "database_operations",
  };
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
