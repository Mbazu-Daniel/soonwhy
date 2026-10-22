import { describe, expect, it } from 'vitest';
import { detectDatabaseTimeouts, type DatabaseTimeoutTrace } from './database-timeout.detector';

const sample = (index: number, overrides: Partial<DatabaseTimeoutTrace> = {}): DatabaseTimeoutTrace => ({
  timestamp: new Date(Date.parse('2026-09-28T10:00:00.000Z') + index * 60_000).toISOString(),
  service: 'api',
  traceId: 'trace-' + index,
  spanId: 'span-' + index,
  duration: 100,
  dependencyType: 'database',
  dependencyName: 'postgresql',
  dbQueryText: 'SELECT * FROM users WHERE id = ?',
  dbSystemName: 'postgresql',
  ...overrides,
});

describe('database timeout detector', () => {
  it('detects repeated database timeouts', () => {
    const samples = [
      ...Array.from({ length: 3 }, (_, index) => sample(index, { errorType: 'timeout' })),
      ...Array.from({ length: 7 }, (_, index) => sample(index + 3)),
    ];
    const result = detectDatabaseTimeouts(samples);
    expect(result).toHaveLength(1);
    expect(result[0]?.signal.timeoutCount).toBe(3);
    expect(result[0]?.signal.totalCount).toBe(10);
    expect(result[0]?.signal.timeoutRate).toBe(0.3);
  });

  it('requires the minimum timeout count', () => {
    expect(detectDatabaseTimeouts([
      sample(0, { errorType: 'timeout' }),
      sample(1, { errorType: 'timeout' }),
    ])).toEqual([]);
  });

  it('requires a meaningful timeout rate', () => {
    const samples = [
      ...Array.from({ length: 3 }, (_, index) => sample(index, { errorType: 'timeout' })),
      ...Array.from({ length: 47 }, (_, index) => sample(index + 3)),
    ];
    expect(detectDatabaseTimeouts(samples)).toEqual([]);
  });

  it('ignores non-database timeout spans', () => {
    expect(detectDatabaseTimeouts(Array.from({ length: 5 }, (_, index) => sample(index, {
      dependencyType: 'http',
      errorType: 'timeout',
    })))).toEqual([]);
  });

  it('isolates database systems', () => {
    const result = detectDatabaseTimeouts([
      ...Array.from({ length: 3 }, (_, index) => sample(index, { errorType: 'timeout' })),
      ...Array.from({ length: 3 }, (_, index) => sample(index + 3, { dbSystemName: 'mysql', errorType: 'timeout' })),
    ]);
    expect(result).toHaveLength(2);
  });
});
