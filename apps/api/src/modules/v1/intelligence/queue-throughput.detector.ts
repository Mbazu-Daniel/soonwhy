import { createTelemetryIdentity } from './telemetry-identity';

const MIN_SAMPLES = 5;
const REGRESSION_PERCENT = 30;

export type QueueType = 'kafka' | 'nats' | 'rabbitmq' | 'other';

export interface QueueOperationTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  queueName: string;
  queueType: QueueType;
  operationName?: string;
}

export interface QueueThroughputCandidate {
  serviceName: string;
  queueName: string;
  queueType: QueueType;
  operationName?: string;
  signal: {
    currentCount: number;
    baselineCount: number;
    currentPerMinute: number;
    baselinePerMinute: number;
    changePercent: number;
  };
  samples: QueueOperationTrace[];
  identity: ReturnType<typeof createTelemetryIdentity>;
  recommendation: string;
}

export function detectQueueThroughput(
  current: QueueOperationTrace[],
  baseline: QueueOperationTrace[],
  windowMinutes = 15,
): QueueThroughputCandidate[] {
  if (!Number.isFinite(windowMinutes) || windowMinutes <= 0) return [];

  const currentGroups = groupByQueue(current);
  const baselineGroups = groupByQueue(baseline);
  const candidates: QueueThroughputCandidate[] = [];

  for (const [key, samples] of currentGroups) {
    if (samples.length < MIN_SAMPLES) continue;

    const baselineSamples = baselineGroups.get(key) ?? [];
    if (baselineSamples.length < MIN_SAMPLES) continue;

    const currentPerMinute = samples.length / windowMinutes;
    const baselinePerMinute = baselineSamples.length / windowMinutes;
    if (baselinePerMinute <= 0) continue;

    const changePercent = ((currentPerMinute - baselinePerMinute) / baselinePerMinute) * 100;
    if (Math.abs(changePercent) < REGRESSION_PERCENT) continue;

    const [serviceName, queueType, queueName, operationName] = key.split('|');
    if (!serviceName || !queueName || !isQueueType(queueType)) continue;

    const direction = changePercent < 0 ? 'dropped' : 'increased';
    candidates.push({
      serviceName,
      queueName,
      queueType,
      ...(operationName ? { operationName } : {}),
      signal: {
        currentCount: samples.length,
        baselineCount: baselineSamples.length,
        currentPerMinute,
        baselinePerMinute,
        changePercent,
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
      recommendation: 'The ' + queueType + ' ' + queueName + ' operation rate ' + direction + ' by ' + Math.abs(changePercent).toFixed(0) + '%. Compare producer and consumer volume, worker concurrency, consumer errors, and deployment changes before changing queue configuration.',
    });
  }

  return candidates;
}

function groupByQueue(samples: QueueOperationTrace[]): Map<string, QueueOperationTrace[]> {
  const groups = new Map<string, QueueOperationTrace[]>();
  for (const sample of samples) {
    if (!sample.service || !sample.queueName || !isQueueType(sample.queueType)) continue;
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
