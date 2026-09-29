import { describe, expect, it } from 'vitest';
import { detectCacheDegradation, detectRedisDegradation, type CacheTrace, type RedisTrace } from './redis-degradation.detector';

let sampleId = 0;
const sample = (overrides: Partial<RedisTrace> = {}): RedisTrace => ({
  timestamp: '2026-09-29T08:00:00.000Z',
  service: 'checkout-api',
  traceId: 'trace-' + (++sampleId),
  spanId: 'span-' + sampleId,
  duration: 80,
  dependencyName: 'cache.internal',
  operationName: 'GET',
  ...overrides,
});

describe('detectCacheDegradation', () => {
  it('requires correlated latency and error signals', () => {
    expect(detectCacheDegradation(Array.from({ length: 5 }, () => sample({ duration: 80 })), [])).toHaveLength(0);
  });

  it('detects Redis latency and error degradation', () => {
    const result = detectRedisDegradation(
      Array.from({ length: 5 }, (_, index) => sample({ duration: 80 + index * 5, errorType: index < 2 ? 'timeout' : undefined, cacheType: 'redis' })),
      [],
    );
    expect(result[0]).toMatchObject({ dependencyName: 'cache.internal', cacheType: 'redis', operationName: 'GET', signal: { errorCount: 2, degradationSignals: ['latency', 'errors'] } });
  });

  it('detects a latency regression against the comparable baseline', () => {
    const result = detectCacheDegradation(
      Array.from({ length: 5 }, (_, index) => sample({ duration: 90 + index * 5, errorType: 'timeout', cacheType: 'redis' })),
      Array.from({ length: 5 }, () => sample({ duration: 20, cacheType: 'redis' })),
    );
    expect(result[0]?.signal.p95DurationChangePercent).toBeGreaterThanOrEqual(50);
  });

  it('keeps cache backends and operations separate', () => {
    const traces: CacheTrace[] = [
      ...Array.from({ length: 5 }, () => sample({ cacheType: 'redis', operationName: 'GET', errorType: 'timeout' })),
      ...Array.from({ length: 5 }, () => sample({ cacheType: 'memcached', operationName: 'GET', errorType: 'timeout' })),
      ...Array.from({ length: 5 }, () => sample({ cacheType: 'redis', operationName: 'SET', errorType: 'timeout' })),
    ];
    const result = detectCacheDegradation(traces, []);
    expect(result.map((candidate) => [candidate.cacheType, candidate.operationName])).toEqual([
      ['redis', 'GET'],
      ['memcached', 'GET'],
      ['redis', 'SET'],
    ]);
  });
});
