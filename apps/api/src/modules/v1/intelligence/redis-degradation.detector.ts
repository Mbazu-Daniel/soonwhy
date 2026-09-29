import { createTelemetryIdentity } from './telemetry-identity';

const MIN_SAMPLES = 5;
const LATENCY_THRESHOLD_MS = 50;
const LATENCY_REGRESSION_PERCENT = 50;
const ERROR_RATE_THRESHOLD = 0.1;

export type CacheType = 'redis' | 'memcached';

export interface CacheTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  dependencyName: string;
  operationName?: string;
  cacheType: CacheType;
  statusCode?: number;
  errorType?: string;
}

export interface CacheCandidate {
  serviceName: string;
  dependencyName: string;
  cacheType: CacheType;
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
  samples: CacheTrace[];
  identity: ReturnType<typeof createTelemetryIdentity>;
  recommendation: string;
}

export type RedisTrace = CacheTrace;
export type RedisCandidate = CacheCandidate;

export function detectRedisDegradation(current: RedisTrace[], baseline: RedisTrace[]): RedisCandidate[] {
  return detectCacheDegradation(current, baseline).filter((candidate) => candidate.cacheType === 'redis');
}

export function detectCacheDegradation(current: CacheTrace[], baseline: CacheTrace[]): CacheCandidate[] {
  const currentGroups = groupByOperation(current);
  const baselineGroups = groupByOperation(baseline);
  const candidates: CacheCandidate[] = [];

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

    const [serviceName, dependencyName, cacheType, operationName] = key.split('|');
    if (!serviceName || !dependencyName || !isCacheType(cacheType)) continue;

    candidates.push({
      serviceName,
      dependencyName,
      cacheType,
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
          dependencyType: cacheType,
          dependencyName,
          ...(operationName ? { cacheOperation: operationName } : {}),
        },
      }),
      recommendation: cacheRecommendation(cacheType),
    });
  }

  return candidates;
}

function groupByOperation(samples: CacheTrace[]): Map<string, CacheTrace[]> {
  const groups = new Map<string, CacheTrace[]>();
  for (const sample of samples) {
    if (!sample.service || !sample.dependencyName || !sample.cacheType || !Number.isFinite(sample.duration) || sample.duration < 0) continue;
    const key = [sample.service, sample.dependencyName, sample.cacheType, sample.operationName ?? ''].join('|');
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }
  return groups;
}

function isCacheType(value: string): value is CacheType {
  return value === 'redis' || value === 'memcached';
}

function isError(sample: CacheTrace): boolean {
  return Boolean(sample.errorType) || (sample.statusCode !== undefined && sample.statusCode >= 500);
}

function cacheRecommendation(cacheType: CacheType): string {
  const backend = cacheType === 'redis' ? 'Redis' : 'Memcached';
  return `Inspect ${backend} command latency and errors, connection reuse, hot keys, payload size, and command frequency. Check whether expensive or repeated operations can be reduced or combined.`;
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
