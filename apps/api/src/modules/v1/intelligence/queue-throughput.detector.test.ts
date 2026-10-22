import { describe, expect, it } from 'vitest';
import { detectQueueThroughput, type QueueOperationTrace } from './queue-throughput.detector';

let sampleId = 0;
const sample = (overrides: Partial<QueueOperationTrace> = {}): QueueOperationTrace => ({
  timestamp: '2026-09-29T08:00:00.000Z',
  service: 'orders-worker',
  traceId: 'trace-' + (++sampleId),
  spanId: 'span-' + sampleId,
  queueName: 'orders',
  queueType: 'kafka',
  operationName: 'consume',
  ...overrides,
});

describe('detectQueueThroughput', () => {
  it('requires a comparable baseline', () => {
    expect(detectQueueThroughput(Array.from({ length: 10 }, () => sample()), [])).toHaveLength(0);
  });

  it('detects a material throughput drop', () => {
    const result = detectQueueThroughput(
      Array.from({ length: 5 }, () => sample()),
      Array.from({ length: 10 }, () => sample()),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      queueType: 'kafka',
      queueName: 'orders',
      operationName: 'consume',
      signal: { currentCount: 5, baselineCount: 10 },
    });
    expect(result[0]?.signal.changePercent).toBe(-50);
  });

  it('keeps queue systems and operations separate', () => {
    const result = detectQueueThroughput(
      [
        ...Array.from({ length: 5 }, () => sample({ queueType: 'kafka', operationName: 'consume' })),
        ...Array.from({ length: 5 }, () => sample({ queueType: 'nats', operationName: 'publish' })),
      ],
      [
        ...Array.from({ length: 10 }, () => sample({ queueType: 'kafka', operationName: 'consume' })),
        ...Array.from({ length: 10 }, () => sample({ queueType: 'nats', operationName: 'publish' })),
      ],
    );

    expect(result.map((candidate) => [candidate.queueType, candidate.operationName])).toEqual([
      ['kafka', 'consume'],
      ['nats', 'publish'],
    ]);
  });

  it('ignores small changes', () => {
    expect(detectQueueThroughput(
      Array.from({ length: 9 }, () => sample()),
      Array.from({ length: 10 }, () => sample()),
    )).toHaveLength(0);
  });
});
