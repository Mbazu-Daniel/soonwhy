import { createTelemetryIdentity } from './telemetry-identity';

const MIN_SAMPLES = 5;
const LATENCY_THRESHOLD_MS = 100;
const LATENCY_REGRESSION_PERCENT = 50;
const ERROR_RATE_THRESHOLD = 0.1;

export type QueueType = 'kafka' | 'nats' | 'rabbitmq' | 'other';

export interface QueueTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  queueName: string;
  queueType: QueueType;
  operationName?: string;
  statusCode?: number;
  errorType?: string;
}

export interface QueueCandidate {
  serviceName: string;
  queueName: string;
  queueType: QueueType;
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
  samples: QueueTrace[];
  identity: ReturnType<typeof createTelemetryIdentity>;
  recommendation: string;
}

export function detectQueueDegradation(current: QueueTrace[], baseline: QueueTrace[]): QueueCandidate[] {
  const currentGroups = groupByQueue(current);
  const baselineGroups = groupByQueue(baseline);
  const candidates: QueueCandidate[] = [];

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

    const [serviceName, queueType, queueName, operationName] = key.split('|');
    if (!serviceName || !queueName || !queueType || !isQueueType(queueType)) continue;

    candidates.push({
      serviceName,
      queueName,
      queueType,
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
        operationName: operationName || queueName,
        identityAttributes: {
          dependencyType: 'queue',
          queueType,
          queueName,
          ...(operationName ? { queueOperation: operationName } : {}),
        },
      }),
      recommendation: 'Inspect queue publish/consume latency, broker errors, retries, consumer concurrency, and queue pressure. Check whether slow consumers, retry loops, or broker saturation explain the degradation.',
    });
  }

  return candidates;
}

function groupByQueue(samples: QueueTrace[]): Map<string, QueueTrace[]> {
  const groups = new Map<string, QueueTrace[]>();
  for (const sample of samples) {
    if (!sample.service || !sample.queueName || !Number.isFinite(sample.duration) || sample.duration < 0) continue;
    const key = [sample.service, sample.queueType, sample.queueName, sample.operationName ?? ''].join('|');
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }
  return groups;
}

function isQueueType(value: string): value is QueueType {
  return value === 'kafka' || value === 'nats' || value === 'rabbitmq' || value === 'other';
}

function isError(sample: QueueTrace): boolean {
  return sample.errorType !== undefined || sample.statusCode !== undefined && sample.statusCode >= 2;
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
