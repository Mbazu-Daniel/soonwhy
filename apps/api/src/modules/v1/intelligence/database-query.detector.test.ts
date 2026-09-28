import { describe, expect, it } from 'vitest';
import { detectDatabaseQueries, type DatabaseQueryTrace } from './database-query.detector';

function sample(overrides: Partial<DatabaseQueryTrace> = {}): DatabaseQueryTrace {
  return {
    timestamp: '2026-09-28T10:00:00.000Z',
    service: 'api',
    traceId: 'trace-1',
    spanId: 'span-1',
    duration: 600,
    dependencyType: 'database',
    dependencyName: 'postgresql',
    dbQueryText: 'SELECT * FROM users WHERE id = ?',
    dbQuerySummary: 'SELECT users',
    dbOperationName: 'SELECT',
    dbSystemName: 'postgresql',
    ...overrides,
  };
}

describe('database query detector', () => {
  it('groups equivalent query text into one identity', () => {
    const candidates = detectDatabaseQueries(
      [
        sample({ duration: 600, traceId: 'trace-1' }),
        sample({ duration: 800, traceId: 'trace-2', dbQueryText: 'SELECT * FROM users WHERE id = ?' }),
      ],
      [],
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.samples).toHaveLength(2);
    expect(candidates[0]?.identity.databaseSystem).toBe('postgresql');
  });

  it('detects a query regression against a sampled baseline', () => {
    const current = Array.from({ length: 20 }, (_, index) =>
      sample({ duration: 480 + index }),
    );
    const baseline = Array.from({ length: 20 }, (_, index) =>
      sample({ duration: 250 + index }),
    );

    const candidates = detectDatabaseQueries(current, baseline);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.signal.severity).toBe('warning');
    expect(candidates[0]?.signal.baselineValue).toBeDefined();
  });

  it('ignores non-database spans', () => {
    expect(
      detectDatabaseQueries(
        [sample({ dependencyType: 'http' })],
        [],
      ),
    ).toEqual([]);
  });
});
