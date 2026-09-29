import { createTelemetryIdentity } from './telemetry-identity';

export type DependencyType = 'database' | 'cache' | 'queue' | 'http' | 'grpc' | 'other';

export interface DependencyObservation {
  serviceName: string;
  dependencyType: DependencyType;
  dependencyName: string;
  operationName?: string;
  sampleCount: number;
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
  signals: Array<'latency' | 'latency_regression' | 'errors' | 'error_regression' | 'throughput_regression'>;
  confidence: 'medium' | 'high';
  summary: string;
}

const MIN_SAMPLES = 5;
const LATENCY_REGRESSION_PERCENT = 50;
const ERROR_REGRESSION_PERCENT = 50;
const THROUGHPUT_REGRESSION_PERCENT = 30;

export function evaluateDependency(observation: DependencyObservation): DependencyFinding | null {
  if (
    !observation.serviceName ||
    !observation.dependencyName ||
    !Number.isFinite(observation.sampleCount) ||
    observation.sampleCount < MIN_SAMPLES
  ) return null;

  const signals: DependencyFinding['signals'] = [];
  const p95 = finite(observation.p95Duration);
  const baselineP95 = finite(observation.baselineP95Duration);
  const errorRate = finite(observation.errorRate);
  const baselineErrorRate = finite(observation.baselineErrorRate);
  const throughput = finite(observation.throughputPerMinute);
  const baselineThroughput = finite(observation.baselineThroughputPerMinute);

  if (p95 !== undefined && p95 >= 100) signals.push('latency');
  if (p95 !== undefined && baselineP95 !== undefined && baselineP95 > 0) {
    if (((p95 - baselineP95) / baselineP95) * 100 >= LATENCY_REGRESSION_PERCENT) signals.push('latency_regression');
  }
  if (errorRate !== undefined && errorRate >= 0.1) signals.push('errors');
  if (errorRate !== undefined && baselineErrorRate !== undefined && baselineErrorRate > 0) {
    if (((errorRate - baselineErrorRate) / baselineErrorRate) * 100 >= ERROR_REGRESSION_PERCENT) signals.push('error_regression');
  }
  if (throughput !== undefined && baselineThroughput !== undefined && baselineThroughput > 0) {
    if (((throughput - baselineThroughput) / baselineThroughput) * 100 <= -THROUGHPUT_REGRESSION_PERCENT) signals.push('throughput_regression');
  }

  if (!signals.length) return null;

  const identity = createTelemetryIdentity({
    domain: 'dependency',
    serviceName: observation.serviceName,
    operationName: observation.operationName ?? observation.dependencyName,
    resourceName: observation.dependencyName,
    identityAttributes: {
      dependencyType: observation.dependencyType,
      dependencyName: observation.dependencyName,
      ...(observation.operationName ? { operationName: observation.operationName } : {}),
    },
  });

  const correlated = signals.length >= 2;
  return {
    identity,
    serviceName: observation.serviceName,
    dependencyType: observation.dependencyType,
    dependencyName: observation.dependencyName,
    ...(observation.operationName ? { operationName: observation.operationName } : {}),
    signals,
    confidence: correlated ? 'high' : 'medium',
    summary: `${observation.dependencyType} dependency ${observation.dependencyName} in ${observation.serviceName} shows ${signals.join(', ')}.`,
  };
}

function finite(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}
