import { createTelemetryIdentity } from './telemetry-identity';

const MIN_SAMPLES = 5;
const LATENCY_THRESHOLD_MS = 50;
const LATENCY_REGRESSION_PERCENT = 50;
const ERROR_RATE_THRESHOLD = 0.1;

export interface RedisTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  dependencyName: string;
  operationName?: string;
  statusCode?: number;
  errorType?: string;
}

export interface RedisCandidate {
  serviceName: string;
  dependencyName: string;
  operationName?: string;
  signal: {
    sampleCount: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
    errorCount: number;
    errorRate: number;
    p95DurationChangePercent?: number;
    degradationSignals: string[];
  };
  samples: RedisTrace[];
  identity: ReturnType<typeof createTelemetryIdentity>;
  recommendation: string;
}

export function detectRedisDegradation(current: RedisTrace[], baseline: RedisTrace[]): RedisCandidate[] {
  const currentGroups = groupByOperation(current);
  const baselineGroups = groupByOperation(baseline);
  const candidates: RedisCandidate[] = [];

  for (const [key, samples] of currentGroups) {
    if (samples.length < MIN_SAMPLES) continue;

    const baselineSamples = baselineGroups.get(key) ?? [];
    const p50Duration = percentile(samples.map((sample) => sample.duration), 0.5);
    const p95Duration = percentile(samples.map((sample) => sample.duration), 0.95);
    const p99Duration = percentile(samples.map((sample) => sample.duration), 0.99);
    const errorCount = samples.filter(isError).length;
    const errorRate = errorCount / samples.length;
    const baselineP95 = baselineSamples.length >= MIN_SAMPLES
      ? percentile(baselineSamples.map((sample) => sample.duration), 0.95)
      : undefined;
    const p95DurationChangePercent = baselineP95 !== undefined && baselineP95 > 0
      ? ((p95Duration - baselineP95) / baselineP95) * 100
      : undefined;

    const degradationSignals: string[] = [];
    if (
      p95Duration >= LATENCY_THRESHOLD_MS ||
      (p95DurationChangePercent !== undefined && p95DurationChangePercent >= LATENCY_REGRESSION_PERCENT)
    ) degradationSignals.push('latency');
    if (errorRate >= ERROR_RATE_THRESHOLD) degradationSignals.push('errors');
    if (degradationSignals.length < 2) continue;

    const [serviceName, dependencyName, operationName] = key.split('|');
    if (!serviceName || !dependencyName) continue;

    candidates.push({
      serviceName,
      dependencyName,
      ...(operationName ? { operationName } : {}),
      signal: {
        sampleCount: samples.length,
        p50Duration,
        p95Duration,
        p99Duration,
        errorCount,
        errorRate,
        ...(p95DurationChangePercent !== undefined ? { p95DurationChangePercent } : {}),
        degradationSignals,
      },
      samples: samples.slice(0, 20),
      identity: createTelemetryIdentity({
        domain: 'dependency',
        serviceName,
        operationName: operationName || dependencyName,
        identityAttributes: {
          dependencyType: 'redis',
          dependencyName,
          ...(operationName ? { redisOperation: operationName } : {}),
        },
      }),
      recommendation: 'Inspect Redis command latency and errors, connection reuse, hot keys, payload size, and command frequency. Check whether expensive or repeated commands can be reduced or combined.',
    });
  }

  return candidates;
}

function groupByOperation(samples: RedisTrace[]): Map<string, RedisTrace[]> {
  const groups = new Map<string, RedisTrace[]>();
  for (const sample of samples) {
    if (!sample.service || !sample.dependencyName || !Number.isFinite(sample.duration) || sample.duration < 0) continue;
    const key = [sample.service, sample.dependencyName, sample.operationName ?? ''].join('|');
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }
  return groups;
}

function isError(sample: RedisTrace): boolean {
  return sample.errorType !== undefined || sample.statusCode !== undefined;
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
