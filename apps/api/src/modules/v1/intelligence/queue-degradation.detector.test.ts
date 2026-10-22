import { describe, expect, it } from 'vitest';
import { detectQueueDegradation, type QueueTrace } from './queue-degradation.detector';

let sampleId = 0;
const sample = (overrides: Partial<QueueTrace> = {}): QueueTrace => ({
  timestamp: '2026-09-29T08:00:00.000Z',
  service: 'orders-worker',
  traceId: 'trace-' + (++sampleId),
  spanId: 'span-' + sampleId,
  duration: 180,
  queueName: 'orders',
  queueType: 'kafka',
  operationName: 'consume',
  ...overrides,
});

describe('detectQueueDegradation', () => {
  it('requires correlated latency and error signals', () => {
    expect(detectQueueDegradation(Array.from({ length: 5 }, () => sample()), [])).toHaveLength(0);
  });

  it('detects Kafka latency and error degradation', () => {
    const result = detectQueueDegradation(
      Array.from({ length: 5 }, (_, index) => sample({
        duration: 180 + index * 10,
        errorType: index < 2 ? 'timeout' : undefined,
      })),
      [],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      serviceName: 'orders-worker',
      queueType: 'kafka',
      queueName: 'orders',
      operationName: 'consume',
      signal: { errorCount: 2, degradationSignals: ['latency', 'errors'] },
    });
  });

  it('detects regression against the comparable baseline', () => {
    const result = detectQueueDegradation(
      Array.from({ length: 5 }, () => sample({ duration: 200, errorType: 'timeout' })),
      Array.from({ length: 5 }, () => sample({ duration: 80 })),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.signal.p95DurationChangePercent).toBeGreaterThanOrEqual(50);
  });

  it('keeps queue systems and operations separate', () => {
    const result = detectQueueDegradation([
      ...Array.from({ length: 5 }, () => sample({ queueType: 'kafka', operationName: 'consume', errorType: 'timeout' })),
      ...Array.from({ length: 5 }, () => sample({ queueType: 'nats', operationName: 'publish', errorType: 'timeout' })),
      ...Array.from({ length: 5 }, () => sample({ queueType: 'rabbitmq', operationName: 'consume', errorType: 'timeout' })),
    ], []);

    expect(result.map((candidate) => [candidate.queueType, candidate.operationName])).toEqual([
      ['kafka', 'consume'],
      ['nats', 'publish'],
      ['rabbitmq', 'consume'],
    ]);
  });
});
