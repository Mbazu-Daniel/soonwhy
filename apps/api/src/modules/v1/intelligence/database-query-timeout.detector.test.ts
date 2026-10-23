import { describe, expect, it } from 'vitest';
import { detectDatabaseQueryTimeouts, type DatabaseQueryTimeoutTrace } from './database-query-timeout.detector';

function sample(overrides: Partial<DatabaseQueryTimeoutTrace> = {}): DatabaseQueryTimeoutTrace {
  return {
    timestamp: '2026-09-28T10:00:00.000Z',
    service: 'api',
    traceId: 'trace-1',
    spanId: 'span-1',
    duration: 6_000,
    dependencyType: 'database',
    dependencyName: 'postgresql',
    dbQueryText: 'SELECT * FROM orders WHERE id = ?',
    dbQuerySummary: 'SELECT orders',
    dbOperationName: 'SELECT',
    dbSystemName: 'postgresql',
    ...overrides,
  };
}

describe('database query timeout detector', () => {
  it('detects repeated long-running queries', () => {
    const candidates = detectDatabaseQueryTimeouts([
      sample({ spanId: 'span-1' }),
      sample({ spanId: 'span-2' }),
      sample({ spanId: 'span-3' }),
      sample({ spanId: 'span-4', duration: 20 }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.signal.occurrences).toBe(3);
    expect(candidates[0]?.signal.timeoutRatio).toBe(0.75);
  });

  it('requires repeated evidence', () => {
    expect(detectDatabaseQueryTimeouts([sample()])).toEqual([]);
  });

  it('requires a meaningful timeout ratio', () => {
    const long = Array.from({ length: 2 }, (_, index) => sample({ spanId: 'long-' + index }));
    const normal = Array.from({ length: 10 }, (_, index) => sample({ spanId: 'normal-' + index, duration: 20 }));
    expect(detectDatabaseQueryTimeouts([...long, ...normal])).toEqual([]);
  });

  it('keeps database systems isolated', () => {
    const candidates = detectDatabaseQueryTimeouts([
      sample({ dbSystemName: 'postgresql' }),
      sample({ dbSystemName: 'postgresql', spanId: 'span-2' }),
      sample({ dbSystemName: 'mysql', spanId: 'span-3' }),
      sample({ dbSystemName: 'mysql', spanId: 'span-4' }),
    ]);
    expect(candidates).toHaveLength(2);
  });
});
