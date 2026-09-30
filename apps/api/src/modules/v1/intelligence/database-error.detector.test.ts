import { describe, expect, it } from 'vitest';
import { detectDatabaseErrors, type DatabaseErrorTrace } from './database-error.detector';

function sample(overrides: Partial<DatabaseErrorTrace> = {}): DatabaseErrorTrace {
  return {
    timestamp: '2026-09-28T10:00:00.000Z',
    service: 'api',
    traceId: 'trace-1',
    spanId: 'span-1',
    duration: 20,
    dependencyType: 'database',
    dependencyName: 'postgresql',
    dbQueryText: 'SELECT * FROM users WHERE id = ?',
    dbQuerySummary: 'SELECT users',
    dbOperationName: 'SELECT',
    dbSystemName: 'postgresql',
    ...overrides,
  };
}

describe('database error detector', () => {
  it('detects a query with a meaningful error rate', () => {
    const candidates = detectDatabaseErrors([
      sample({ statusCode: 0, spanId: 'ok-1' }),
      sample({ statusCode: 2, spanId: 'error-1' }),
      sample({ statusCode: 2, spanId: 'error-2' }),
      sample({ statusCode: 2, spanId: 'error-3' }),
      sample({ statusCode: 0, spanId: 'ok-2' }),
      sample({ statusCode: 0, spanId: 'ok-3' }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.signal.errorCount).toBe(3);
    expect(candidates[0]?.signal.totalCount).toBe(6);
    expect(candidates[0]?.signal.errorRate).toBe(0.5);
  });

  it('requires enough errors', () => {
    expect(detectDatabaseErrors([
      sample({ statusCode: 2, spanId: 'error-1' }),
      sample({ statusCode: 2, spanId: 'error-2' }),
      sample({ statusCode: 0, spanId: 'ok-1' }),
    ])).toEqual([]);
  });

  it('requires a meaningful error rate', () => {
    const errors = Array.from({ length: 3 }, (_, i) => sample({ statusCode: 2, spanId: 'error-' + i }));
    const successes = Array.from({ length: 30 }, (_, i) => sample({ statusCode: 0, spanId: 'ok-' + i }));
    expect(detectDatabaseErrors([...errors, ...successes])).toEqual([]);
  });

  it('keeps database systems isolated', () => {
    const candidates = detectDatabaseErrors([
      sample({ statusCode: 2, dbSystemName: 'postgresql', spanId: 'pg-1' }),
      sample({ statusCode: 2, dbSystemName: 'postgresql', spanId: 'pg-2' }),
      sample({ statusCode: 2, dbSystemName: 'postgresql', spanId: 'pg-3' }),
      sample({ statusCode: 2, dbSystemName: 'mysql', spanId: 'my-1' }),
      sample({ statusCode: 2, dbSystemName: 'mysql', spanId: 'my-2' }),
      sample({ statusCode: 2, dbSystemName: 'mysql', spanId: 'my-3' }),
    ]);
    expect(candidates).toHaveLength(2);
  });

  it('ignores non-database spans', () => {
    expect(detectDatabaseErrors([
      sample({ statusCode: 2, dependencyType: 'http' }),
      sample({ statusCode: 2, spanId: 'db-1' }),
      sample({ statusCode: 2, spanId: 'db-2' }),
      sample({ statusCode: 2, spanId: 'db-3' }),
    ])).toHaveLength(1);
  });
});
