import { describe, expect, it } from 'vitest';
import { detectRedisDegradation, type RedisTrace } from './redis-degradation.detector';

let sampleId = 0;
const sample = (overrides: Partial<RedisTrace> = {}): RedisTrace => ({
  timestamp: '2026-09-29T08:00:00.000Z',
  service: 'checkout-api',
  traceId: 'trace-' + (++sampleId),
  spanId: 'span-' + sampleId,
  duration: 80,
  dependencyName: 'redis.internal',
  operationName: 'GET',
  ...overrides,
});

describe('detectRedisDegradation', () => {
  it('requires correlated latency and error signals', () => {
    expect(detectRedisDegradation(
      Array.from({ length: 5 }, () => sample({ duration: 80 })),
      [],
    )).toHaveLength(0);
  });

  it('detects Redis latency and error degradation', () => {
    const result = detectRedisDegradation(
      Array.from({ length: 5 }, (_, index) => sample({
        duration: 80 + index * 5,
        errorType: index < 2 ? 'timeout' : undefined,
      })),
      [],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      serviceName: 'checkout-api',
      dependencyName: 'redis.internal',
      operationName: 'GET',
      signal: {
        errorCount: 2,
        degradationSignals: ['latency', 'errors'],
      },
    });
  });

  it('detects a latency regression against the comparable baseline', () => {
    const result = detectRedisDegradation(
      Array.from({ length: 5 }, (_, index) => sample({ duration: 90 + index * 5, errorType: 'timeout' })),
      Array.from({ length: 5 }, () => sample({ duration: 20 })),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.signal.p95DurationChangePercent).toBeGreaterThanOrEqual(50);
  });

  it('keeps Redis commands separate', () => {
    const result = detectRedisDegradation(
      [
        ...Array.from({ length: 5 }, () => sample({ operationName: 'GET', errorType: 'timeout' })),
        ...Array.from({ length: 5 }, () => sample({ operationName: 'SET', errorType: 'timeout' })),
      ],
      [],
    );

    expect(result.map((candidate) => candidate.operationName)).toEqual(['GET', 'SET']);
  });
});
