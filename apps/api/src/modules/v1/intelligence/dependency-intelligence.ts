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
const THROUGHPUT_REGRESSION_PERCENT = 30;
const LATENCY_SIGNAL_MS = 100;
const ERROR_SIGNAL_RATE = 0.1;

export function evaluateDependency(observation: DependencyObservation): DependencyFinding | null {
  if (!hasValidSampleCounts(observation)) return null;

  const signals: DependencySignal[] = [];
  const p95 = finiteNonNegative(observation.p95Duration);
  const baselineP95 = finitePositive(observation.baselineP95Duration);
  const errorRate = finiteRate(observation.errorRate);
  const baselineErrorRate = finiteRate(observation.baselineErrorRate);
  const throughput = finiteNonNegative(observation.throughputPerMinute);
  const baselineThroughput = finitePositive(observation.baselineThroughputPerMinute);

  if (p95 !== undefined && p95 >= LATENCY_SIGNAL_MS) signals.push('latency');

  const latencyRegressionPercent = percentageIncrease(p95, baselineP95);
  if (latencyRegressionPercent !== undefined && latencyRegressionPercent >= LATENCY_REGRESSION_PERCENT) {
    signals.push('latency_regression');
  }

  if (errorRate !== undefined && errorRate >= ERROR_SIGNAL_RATE) signals.push('errors');

  const errorRegressionPercent = percentageIncrease(errorRate, baselineErrorRate);
  if (errorRegressionPercent !== undefined && errorRegressionPercent >= ERROR_REGRESSION_PERCENT) {
    signals.push('error_regression');
  }

  const throughputRegressionPercent = percentageDecrease(throughput, baselineThroughput);
  if (throughputRegressionPercent !== undefined && throughputRegressionPercent >= THROUGHPUT_REGRESSION_PERCENT) {
    signals.push('throughput_regression');
  }

  if (!signals.length) return null;

  const identity = createTelemetryIdentity({
    domain: 'dependency',
    serviceName: observation.serviceName,
    ...(observation.operationName ? { operationName: observation.operationName } : {}),
    resourceName: observation.dependencyName,
    identityAttributes: {
      dependencyType: observation.dependencyType,
      dependencyName: observation.dependencyName,
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
    serviceName: observation.serviceName,
    dependencyType: observation.dependencyType,
    dependencyName: observation.dependencyName,
    ...(observation.operationName ? { operationName: observation.operationName } : {}),
    signals,
    confidence: signalFamilies.size >= 2 ? 'high' : 'medium',
    ...(latencyRegressionPercent !== undefined ? { latencyRegressionPercent } : {}),
    ...(errorRegressionPercent !== undefined ? { errorRegressionPercent } : {}),
    ...(throughputRegressionPercent !== undefined ? { throughputRegressionPercent } : {}),
    summary: `${observation.dependencyType} dependency ${observation.dependencyName} in ${observation.serviceName} shows ${signals.join(', ')}.`,
  };
}

function hasValidSampleCounts(observation: DependencyObservation): boolean {
  return (
    observation.serviceName.length > 0 &&
    observation.dependencyName.length > 0 &&
    Number.isInteger(observation.sampleCount) &&
    observation.sampleCount >= MIN_SAMPLES &&
    (observation.baselineSampleCount === undefined ||
      (Number.isInteger(observation.baselineSampleCount) && observation.baselineSampleCount >= MIN_BASELINE_SAMPLES))
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

function finiteNonNegative(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function finitePositive(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
}

function finiteRate(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined;
}
