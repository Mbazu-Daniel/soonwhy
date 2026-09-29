import { createTelemetryIdentity } from './telemetry-identity';

const MIN_SAMPLES = 5;
const LATENCY_THRESHOLD_MS = 500;
const LATENCY_REGRESSION_PERCENT = 50;
const ERROR_RATE_THRESHOLD = 0.1;
const CRITICAL_ERROR_RATE = 0.5;
const CRITICAL_P95_DURATION_MS = 1000;

export interface ExternalDependencyTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  dependencyType: 'http' | 'rpc';
  dependencyName: string;
  statusCode?: number;
  errorType?: string;
}

interface Signal {
  sampleCount: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  errorCount: number;
  errorRate: number;
  p95DurationChangePercent?: number;
  baselineErrorRate?: number;
  errorRateChangePercent?: number;
  degradationSignals: string[];
  confidence: 'medium' | 'high';
}

export interface ExternalDependencyCandidate {
  serviceName: string;
  dependencyType: string;
  dependencyName: string;
  signal: Signal;
  samples: ExternalDependencyTrace[];
  identity: ReturnType<typeof createTelemetryIdentity>;
  recommendation: string;
}

export function detectExternalDependencyDegradation(
  current: ExternalDependencyTrace[],
  baseline: ExternalDependencyTrace[],
): ExternalDependencyCandidate[] {
  const currentGroups = groupByDependency(current);
  const baselineGroups = groupByDependency(baseline);
  const candidates: ExternalDependencyCandidate[] = [];

  for (const [key, samples] of currentGroups) {
    if (samples.length < MIN_SAMPLES) continue;

    const baselineSamples = baselineGroups.get(key) ?? [];
    const currentP95 = percentile(samples.map((sample) => sample.duration), 0.95);
    const currentP50 = percentile(samples.map((sample) => sample.duration), 0.5);
    const currentP99 = percentile(samples.map((sample) => sample.duration), 0.99);
    const errorCount = samples.filter(isError).length;
    const errorRate = errorCount / samples.length;
    const baselineP95 = baselineSamples.length >= MIN_SAMPLES
      ? percentile(baselineSamples.map((sample) => sample.duration), 0.95)
      : undefined;
    const baselineErrorCount = baselineSamples.filter(isError).length;
    const baselineErrorRate = baselineSamples.length >= MIN_SAMPLES
      ? baselineErrorCount / baselineSamples.length
      : undefined;
    const errorRateChangePercent = baselineErrorRate !== undefined && baselineErrorRate > 0
      ? ((errorRate - baselineErrorRate) / baselineErrorRate) * 100
      : undefined;
    const p95DurationChangePercent = baselineP95 !== undefined && baselineP95 > 0
      ? ((currentP95 - baselineP95) / baselineP95) * 100
      : undefined;

    const degradationSignals: string[] = [];
    if (
      currentP95 >= LATENCY_THRESHOLD_MS ||
      (p95DurationChangePercent !== undefined && p95DurationChangePercent >= LATENCY_REGRESSION_PERCENT)
    ) {
      degradationSignals.push('latency');
    }
    if (
      errorRate >= ERROR_RATE_THRESHOLD ||
      (baselineErrorRate !== undefined && errorRate > baselineErrorRate && errorRate >= ERROR_RATE_THRESHOLD)
    ) {
      degradationSignals.push('errors');
    }

    if (degradationSignals.length < 2) continue;

    const [serviceName, dependencyType, dependencyName] = key.split('|');
    if (!serviceName || !dependencyType || !dependencyName || !['http', 'rpc'].includes(dependencyType)) continue;

    candidates.push({
      serviceName,
      dependencyType,
      dependencyName,
      signal: {
        sampleCount: samples.length,
        p50Duration: currentP50,
        p95Duration: currentP95,
        p99Duration: currentP99,
        errorCount,
        errorRate,
        ...(p95DurationChangePercent !== undefined ? { p95DurationChangePercent } : {}),
        ...(baselineErrorRate !== undefined ? { baselineErrorRate } : {}),
        ...(errorRateChangePercent !== undefined ? { errorRateChangePercent } : {}),
        degradationSignals,
        confidence: degradationSignals.length >= 2 ? 'medium' : 'high',
      },
      samples: samples.filter((sample) => Number.isFinite(sample.duration) && sample.duration >= 0).slice(0, 20),
      identity: createTelemetryIdentity({
        domain: 'dependency',
        serviceName,
        operationName: dependencyName,
        identityAttributes: {
          dependencyType,
          dependencyName,
        },
      }),
      recommendation: recommendationFor(dependencyType),
    });
  }

  return candidates;
}

function groupByDependency(samples: ExternalDependencyTrace[]): Map<string, ExternalDependencyTrace[]> {
  const groups = new Map<string, ExternalDependencyTrace[]>();
  for (const sample of samples) {
    if (!sample.service || !sample.dependencyName || !sample.dependencyType) continue;
    const key = [sample.service, sample.dependencyType, sample.dependencyName].join('|');
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }
  return groups;
}

function isError(sample: ExternalDependencyTrace): boolean {
  return sample.errorType !== undefined || sample.statusCode === 2 || (sample.statusCode !== undefined && sample.statusCode >= 500);
}

function percentile(values: number[], rank: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * rank;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  return (sorted[lower] ?? 0) + ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * (index - lower);
}

function recommendationFor(dependencyType: string): string {
  if (dependencyType === 'http') {
    return 'Inspect downstream latency, HTTP errors, retries, timeouts, and payload size. Check whether repeated calls can be avoided or batched and verify retry behavior is not amplifying load.';
  }

  return 'Inspect downstream RPC latency, status or error patterns, retries, timeouts, and connection reuse. Check whether repeated calls can be avoided or combined.';
}
