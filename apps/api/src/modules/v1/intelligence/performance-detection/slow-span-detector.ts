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

export function detectSlowSpans(
  spans: Array<{
    spanName: string;
    durationMs: number;
    traceId?: string;
    parentSpanId?: string;
    timestamp: string;
  }>,
  slowThresholdMs: number = 500,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): SpanFinding[] {
  const findings: SpanFinding[] = [];

  for (const span of spans) {
    if (span.durationMs < slowThresholdMs) continue;

    const severity =
      span.durationMs >= slowThresholdMs * 2 ? "critical" : "warning";

    const identity = createTelemetryIdentity({
      domain: "performance",
      operationName: span.spanName,
      identityAttributes: {
        spanName: span.spanName,
      },
    });

    findings.push({
      identity,
      metric: "span_duration",
      observedValue: span.durationMs,
      unit: "ms",
      severity,
      reason: `Span exceeded slow threshold of ${slowThresholdMs}ms.`,
      detectedAt: span.timestamp,
      evidence: {
        window: {
          start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        samples: 1,
      },
      spanName: span.spanName,
      traceId: span.traceId,
      parentSpanId: span.parentSpanId,
    });
  }

  return findings;
}
