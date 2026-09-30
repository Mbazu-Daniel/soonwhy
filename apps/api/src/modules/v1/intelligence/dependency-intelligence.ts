import { createTelemetryIdentity } from './telemetry-identity';

export type DependencyType = 'database' | 'cache' | 'queue' | 'http' | 'grpc' | 'other';
export type DependencySignal =
  | 'latency'
  | 'latency_regression'
  | 'errors'
  | 'error_regression'
  | 'throughput_regression';

export interface DependencyObservation {
  serviceName: string;
  dependencyType: DependencyType;
  dependencyName: string;
  operationName?: string;
  sampleCount: number;
  baselineSampleCount?: number;
  p50Duration?: number;
  p95Duration?: number;
  p99Duration?: number;
  errorCount?: number;
  errorRate?: number;
  baselineP95Duration?: number;
  baselineErrorRate?: number;
  throughputPerMinute?: number;
  baselineThroughputPerMinute?: number;
}

export interface DependencyFinding {
  identity: ReturnType<typeof createTelemetryIdentity>;
  serviceName: string;
  dependencyType: DependencyType;
  dependencyName: string;
  operationName?: string;
  signals: DependencySignal[];
  confidence: 'medium' | 'high';
  latencyRegressionPercent?: number;
  errorRegressionPercent?: number;
  throughputRegressionPercent?: number;
  summary: string;
}

const MIN_SAMPLES = 5;
const MIN_BASELINE_SAMPLES = 5;
const LATENCY_REGRESSION_PERCENT = 50;
const ERROR_REGRESSION_PERCENT = 50;
const ERROR_REGRESSION_DELTA = 0.05;
const THROUGHPUT_REGRESSION_PERCENT = 30;
const LATENCY_SIGNAL_MS = 100;
const ERROR_SIGNAL_RATE = 0.1;

export function evaluateDependency(
  observation: DependencyObservation,
): DependencyFinding | null {
  if (!hasValidObservation(observation)) return null;

  const signals: DependencySignal[] = [];
  const p95 = finiteNonNegative(observation.p95Duration);
  const baselineP95 = finitePositive(observation.baselineP95Duration);
  const errorRate = finiteRate(observation.errorRate);
  const baselineErrorRate = finiteRate(observation.baselineErrorRate);
  const throughput = finiteNonNegative(observation.throughputPerMinute);
  const baselineThroughput = finitePositive(observation.baselineThroughputPerMinute);

  if (p95 !== undefined && p95 >= LATENCY_SIGNAL_MS) signals.push('latency');

  const latencyRegressionPercent = percentageIncrease(p95, baselineP95);
  if (
    latencyRegressionPercent !== undefined &&
    latencyRegressionPercent >= LATENCY_REGRESSION_PERCENT
  ) {
    signals.push('latency_regression');
  }

  if (errorRate !== undefined && errorRate >= ERROR_SIGNAL_RATE) {
    signals.push('errors');
  }

  const errorRegressionPercent = percentageIncrease(errorRate, baselineErrorRate);
  const errorDelta =
    errorRate !== undefined && baselineErrorRate !== undefined
      ? errorRate - baselineErrorRate
      : undefined;

  if (
    errorRegressionPercent !== undefined &&
    errorDelta !== undefined &&
    errorRegressionPercent >= ERROR_REGRESSION_PERCENT &&
    errorDelta >= ERROR_REGRESSION_DELTA
  ) {
    signals.push('error_regression');
  }

  const throughputRegressionPercent = percentageDecrease(throughput, baselineThroughput);
  if (
    throughputRegressionPercent !== undefined &&
    throughputRegressionPercent >= THROUGHPUT_REGRESSION_PERCENT
  ) {
    signals.push('throughput_regression');
  }

  if (!signals.length) return null;

  const operationName = observation.operationName?.trim();
  const identity = createTelemetryIdentity({
    domain: 'dependency',
    serviceName: observation.serviceName.trim(),
    ...(operationName ? { operationName } : {}),
    resourceName: observation.dependencyName.trim(),
    identityAttributes: {
      dependencyType: observation.dependencyType,
      dependencyName: observation.dependencyName.trim(),
    },
  });

  const signalFamilies = new Set(
    signals.map((signal) => {
      if (signal.startsWith('latency')) return 'latency';
      if (signal.startsWith('error')) return 'errors';
      return 'throughput';
    }),
  );

  return {
    identity,
    serviceName: observation.serviceName.trim(),
    dependencyType: observation.dependencyType,
    dependencyName: observation.dependencyName.trim(),
    ...(operationName ? { operationName } : {}),
    signals,
    confidence: signalFamilies.size >= 2 ? 'high' : 'medium',
    ...(latencyRegressionPercent !== undefined ? { latencyRegressionPercent } : {}),
    ...(errorRegressionPercent !== undefined ? { errorRegressionPercent } : {}),
    ...(throughputRegressionPercent !== undefined ? { throughputRegressionPercent } : {}),
    summary: `${observation.dependencyType} dependency ${observation.dependencyName.trim()} in ${observation.serviceName.trim()} shows ${signals.join(', ')}.`,
  };
}

function hasValidObservation(observation: DependencyObservation): boolean {
  const serviceName = observation.serviceName.trim();
  const dependencyName = observation.dependencyName.trim();
  const hasBaselineMetric =
    observation.baselineP95Duration !== undefined ||
    observation.baselineErrorRate !== undefined ||
    observation.baselineThroughputPerMinute !== undefined;

  if (
    !serviceName ||
    !dependencyName ||
    !Number.isInteger(observation.sampleCount) ||
    observation.sampleCount < MIN_SAMPLES ||
    (hasBaselineMetric &&
      (!Number.isInteger(observation.baselineSampleCount) ||
        observation.baselineSampleCount < MIN_BASELINE_SAMPLES)) ||
    (!hasBaselineMetric && observation.baselineSampleCount !== undefined)
  ) {
    return false;
  }

  if (
    observation.errorCount !== undefined &&
    (!Number.isInteger(observation.errorCount) ||
      observation.errorCount < 0 ||
      observation.errorCount > observation.sampleCount)
  ) {
    return false;
  }

  return (
    validMetric(observation.p50Duration) &&
    validMetric(observation.p95Duration) &&
    validMetric(observation.p99Duration) &&
    validMetric(observation.baselineP95Duration) &&
    validMetric(observation.throughputPerMinute) &&
    validMetric(observation.baselineThroughputPerMinute) &&
    validRate(observation.errorRate) &&
    validRate(observation.baselineErrorRate)
  );
}

function percentageIncrease(current: number | undefined, baseline: number | undefined): number | undefined {
  if (current === undefined || baseline === undefined || baseline <= 0) return undefined;
  return ((current - baseline) / baseline) * 100;
}

function percentageDecrease(current: number | undefined, baseline: number | undefined): number | undefined {
  if (current === undefined || baseline === undefined || baseline <= 0) return undefined;
  return ((baseline - current) / baseline) * 100;
}

function validMetric(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0);
}

function finiteNonNegative(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function finitePositive(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
}

function finiteRate(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : undefined;
}

function validRate(value: number | undefined): boolean {
  return value === undefined || finiteRate(value) !== undefined;
}
