import { describe, expect, it } from 'vitest';
import { detectDatabaseQueries, type DatabaseQueryTrace } from './database-query.detector';

function sample(overrides: Partial<DatabaseQueryTrace> = {}): DatabaseQueryTrace {
  return {
    timestamp: '2026-09-28T10:00:00.000Z', service: 'api', traceId: 'trace-1', spanId: 'span-1', duration: 600,
    dependencyType: 'database', dependencyName: 'postgresql', dbQueryText: 'SELECT * FROM users WHERE id = ?',
    dbQuerySummary: 'SELECT users', dbOperationName: 'SELECT', dbSystemName: 'postgresql', ...overrides,
  };
}

describe('database query detector', () => {
  it('groups equivalent query text into one identity and keeps the latency distribution', () => {
    const candidates = detectDatabaseQueries(
      [sample({ duration: 600, traceId: 'trace-1' }), sample({ duration: 800, traceId: 'trace-2' })], [],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.samples).toHaveLength(2);
    expect(candidates[0]?.identity.databaseSystem).toBe('postgresql');
    expect(candidates[0]?.signal.distribution.p50).toBe(700);
    expect(candidates[0]?.signal.distribution.p95).toBe(790);
    expect(candidates[0]?.signal.distribution.p99).toBe(798);
  });

  it('detects a query regression against a sampled baseline', () => {
    const current = Array.from({ length: 20 }, (_, index) => sample({ duration: 480 + index }));
    const baseline = Array.from({ length: 20 }, (_, index) => sample({ duration: 250 + index }));
    const candidates = detectDatabaseQueries(current, baseline);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.signal.severity).toBe('warning');
    expect(candidates[0]?.signal.baselineValue).toBeDefined();
    expect(candidates[0]?.signal.distribution.sampleCount).toBe(20);
    expect(candidates[0]?.signal.distribution.p50).toBe(489.5);
    expect(candidates[0]?.signal.distribution.p99).toBe(498.81);
  });

  it('does not combine the same query across services', () => {
    const candidates = detectDatabaseQueries([sample({ service: 'api-a', duration: 600 }), sample({ service: 'api-b', duration: 600 })], []);
    expect(candidates).toHaveLength(2);
    expect(candidates.map((candidate) => candidate.serviceName)).toEqual(['api-a', 'api-b']);
  });

  it('ignores non-database spans', () => {
    expect(detectDatabaseQueries([sample({ dependencyType: 'http' })], [])).toEqual([]);
  });
});
