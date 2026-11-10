import { createTelemetryIdentity } from "./telemetry-identity";

export interface PerformanceObservation {
  serviceName: string;
  endpointName: string;
  sampleCount: number;
  baselineSampleCount?: number;
  p95Duration?: number;
  baselineP95Duration?: number;
  throughputPerMinute?: number;
  baselineThroughputPerMinute?: number;
  errorRate?: number;
  baselineErrorRate?: number;
}

export type PerformanceSignal =
  | "latency"
  | "latency_regression"
  | "throughput_regression"
  | "error_regression";

export interface PerformanceFinding {
  identity: ReturnType<typeof createTelemetryIdentity>;
  serviceName: string;
  endpointName: string;
  signals: PerformanceSignal[];
  confidence: "medium" | "high";
  latencyRegressionPercent?: number;
  throughputRegressionPercent?: number;
  errorRegressionPercent?: number;
  summary: string;
}

export type PerformanceThresholds = Partial<{
  minSamples: number;
  minBaselineSamples: number;
  latencySignalMs: number;
  latencyRegressionPercent: number;
  throughputRegressionPercent: number;
  errorRegressionPercent: number;
  errorRegressionDelta: number;
}>;

const DEFAULT_MIN_SAMPLES = 10;
const DEFAULT_MIN_BASELINE_SAMPLES = 10;

function finite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

export function evaluatePerformance(
  observation: PerformanceObservation,
  thresholds: PerformanceThresholds = {},
): PerformanceFinding | null {
  const minSamples = finite(thresholds.minSamples, DEFAULT_MIN_SAMPLES);
  const minBaselineSamples = finite(thresholds.minBaselineSamples, DEFAULT_MIN_BASELINE_SAMPLES);
  const latencySignalMs = finite(thresholds.latencySignalMs, 100);
  const latencyRegressionPercent = finite(thresholds.latencyRegressionPercent, 50);
  const throughputRegressionPercent = finite(thresholds.throughputRegressionPercent, 30);
  const errorRegressionPercent = finite(thresholds.errorRegressionPercent, 50);
  const errorRegressionDelta = finite(thresholds.errorRegressionDelta, 0.05);
  const serviceName = observation.serviceName.trim();
  const endpointName = observation.endpointName.trim();
  const hasBaseline =
    observation.baselineP95Duration !== undefined ||
    observation.baselineThroughputPerMinute !== undefined ||
    observation.baselineErrorRate !== undefined;

  if (
    !serviceName ||
    !endpointName ||
    !Number.isInteger(observation.sampleCount) ||
    observation.sampleCount < minSamples
  )
    return null;
  if (
    hasBaseline &&
    (!Number.isInteger(observation.baselineSampleCount) ||
      observation.baselineSampleCount! < minBaselineSamples)
  )
    return null;
  if (!hasBaseline && observation.baselineSampleCount !== undefined)
    return null;

  const values = [
    observation.p95Duration,
    observation.baselineP95Duration,
    observation.throughputPerMinute,
    observation.baselineThroughputPerMinute,
    observation.errorRate,
    observation.baselineErrorRate,
  ];
  if (values.some((value) => value !== undefined && !Number.isFinite(value)))
    return null;
  if (values.some((value) => value !== undefined && value < 0)) return null;
  if (observation.errorRate !== undefined && observation.errorRate > 1)
    return null;
  if (
    observation.baselineErrorRate !== undefined &&
    observation.baselineErrorRate > 1
  )
    return null;

  const signals: PerformanceSignal[] = [];
  if ((observation.p95Duration ?? 0) >= latencySignalMs) signals.push("latency");

  const regressionPercent = increase(
    observation.p95Duration,
    observation.baselineP95Duration,
  );
  if (regressionPercent !== undefined && regressionPercent >= latencyRegressionPercent)
    signals.push("latency_regression");

  const throughputPercent = decrease(
    observation.throughputPerMinute,
    observation.baselineThroughputPerMinute,
  );
  if (
    throughputPercent !== undefined &&
    throughputPercent >= throughputRegressionPercent
  )
    signals.push("throughput_regression");

  const errorPercent = increase(
    observation.errorRate,
    observation.baselineErrorRate,
  );
  const errorDelta =
    observation.errorRate !== undefined &&
    observation.baselineErrorRate !== undefined
      ? observation.errorRate - observation.baselineErrorRate
      : undefined;
  if (
    errorPercent !== undefined &&
    errorDelta !== undefined &&
    errorPercent >= errorRegressionPercent &&
    errorDelta >= errorRegressionDelta
  ) {
    signals.push("error_regression");
  }

  if (!signals.length) return null;

  const families = new Set(
    signals.map((signal) =>
      signal === "throughput_regression"
        ? "throughput"
        : signal === "error_regression"
          ? "errors"
          : "latency",
    ),
  );
  const identity = createTelemetryIdentity({
    domain: "performance",
    serviceName,
    operationName: endpointName,
    resourceName: endpointName,
    identityAttributes: { endpointName },
  });

  return {
    identity,
    serviceName,
    endpointName,
    signals,
    confidence: families.size >= 2 ? "high" : "medium",
    ...(regressionPercent !== undefined
      ? { latencyRegressionPercent: regressionPercent }
      : {}),
    ...(throughputPercent !== undefined
      ? { throughputRegressionPercent: throughputPercent }
      : {}),
    ...(errorPercent !== undefined ? { errorRegressionPercent: errorPercent } : {}),
    summary:
      serviceName +
      " endpoint " +
      endpointName +
      " shows " +
      signals.join(", ") +
      ".",
  };
}

function increase(current?: number, baseline?: number): number | undefined {
  if (current === undefined || baseline === undefined || baseline <= 0)
    return undefined;
  return ((current - baseline) / baseline) * 100;
}

function decrease(current?: number, baseline?: number): number | undefined {
  if (current === undefined || baseline === undefined || baseline <= 0)
    return undefined;
  return ((baseline - current) / baseline) * 100;
}
