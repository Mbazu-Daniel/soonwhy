import { describe, expect, it } from 'vitest';
import { detectDatabaseDependencyDegradation, type DatabaseDependencyTrace } from './database-dependency-degradation.detector';

const sample = (index: number, overrides: Partial<DatabaseDependencyTrace> = {}): DatabaseDependencyTrace => ({
  timestamp: new Date(Date.parse('2026-09-29T04:00:00.000Z') + index * 60_000).toISOString(),
  service: 'checkout-api',
  traceId: 'trace-' + index,
  spanId: 'span-' + index,
  duration: 600,
  dependencyType: 'database',
  dependencyName: 'postgresql',
  dbSystemName: 'postgresql',
  dbQueryText: 'SELECT * FROM orders WHERE id = ?',
  ...overrides,
});

describe('database dependency degradation detector', () => {
  it('correlates latency and errors into one dependency finding', () => {
    const result = detectDatabaseDependencyDegradation(
      Array.from({ length: 10 }, (_, index) => sample(index, {
        duration: 600,
        statusCode: 2,
        dbBatchSize: 4,
      })),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.signal.degradationSignals).toEqual(['latency', 'errors']);
    expect(result[0]?.signal.errorRate).toBe(1);
    expect(result[0]?.signal.batchOperationCount).toBe(10);
  });

  it('correlates pool pressure with database latency', () => {
    const result = detectDatabaseDependencyDegradation(
      Array.from({ length: 10 }, (_, index) => sample(index, { duration: 600 })),
      [],
      Array.from({ length: 5 }, (_, index) => ({
        timestamp: new Date(Date.parse('2026-09-29T04:00:00.000Z') + index * 60_000).toISOString(),
        service: 'checkout-api',
        poolName: 'primary',
        usedConnections: 9,
        maxConnections: 10,
      })),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.signal.poolPressure).toBe(true);
    expect(result[0]?.signal.degradationSignals).toEqual(['latency', 'connection_pool']);
  });

  it('correlates connection wait with database latency', () => {
    const result = detectDatabaseDependencyDegradation(
      Array.from({ length: 10 }, (_, index) => sample(index, { duration: 600 })),
      [],
      [],
      Array.from({ length: 5 }, (_, index) => ({
        timestamp: new Date(Date.parse('2026-09-29T04:00:00.000Z') + index * 60_000).toISOString(),
        service: 'checkout-api',
        poolName: 'primary',
        waitTimeMs: 75,
      })),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.signal.connectionWaitPressure).toBe(true);
  });

  it('does not create a compound finding from a single weak signal', () => {
    const result = detectDatabaseDependencyDegradation(
      Array.from({ length: 10 }, (_, index) => sample(index, { duration: 200 })),
    );

    expect(result).toEqual([]);
  });

  it('detects a latency regression even when current latency is below the absolute threshold', () => {
    const baseline = Array.from({ length: 10 }, (_, index) => sample(index, { duration: 100 }));
    const current = Array.from({ length: 10 }, (_, index) => sample(index + 10, { duration: 160, statusCode: 2 }));

    const result = detectDatabaseDependencyDegradation(current, baseline);

    expect(result).toHaveLength(1);
    expect(result[0]?.signal.p95DurationChangePercent).toBe(60);
    expect(result[0]?.signal.degradationSignals).toEqual(['latency', 'errors']);
  });
});
