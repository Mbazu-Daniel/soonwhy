import { describe, expect, it } from 'vitest';
import { detectDatabaseResultSets, type DatabaseResultSetTrace } from './database-result-set.detector';

const sample = (
  index: number,
  returnedRows: number,
  overrides: Partial<DatabaseResultSetTrace> = {},
): DatabaseResultSetTrace => ({
  timestamp: new Date(Date.parse('2026-09-29T04:00:00.000Z') + index * 60_000).toISOString(),
  service: 'api',
  traceId: 'trace-' + index,
  spanId: 'span-' + index,
  duration: 100 + returnedRows / 10,
  traceDuration: 500,
  dependencyType: 'database',
  dependencyName: 'postgresql',
  returnedRows,
  dbQueryText: 'SELECT * FROM users WHERE team_id = ?',
  dbSystemName: 'postgresql',
  endpoint: 'GET /users',
  ...overrides,
});

describe('database result set detector', () => {
  it('detects repeated large result sets with p50/p95/p99 evidence', () => {
    const result = detectDatabaseResultSets(
      Array.from({ length: 10 }, (_, index) => sample(index, index < 5 ? 2_000 : 2_500)),
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.signal.sampleCount).toBe(10);
    expect(result.candidates[0]?.signal.p50ReturnedRows).toBe(2_250);
    expect(result.candidates[0]?.signal.p95ReturnedRows).toBeGreaterThan(2_000);
    expect(result.candidates[0]?.signal.p99ReturnedRows).toBeGreaterThanOrEqual(result.candidates[0]?.signal.p95ReturnedRows ?? 0);
    expect(result.candidates[0]?.signal.p50Duration).toBeGreaterThan(0);
    expect(result.candidates[0]?.signal.p95Duration).toBeGreaterThanOrEqual(result.candidates[0]?.signal.p50Duration ?? 0);
    expect(result.candidates[0]?.signal.p99Duration).toBeGreaterThanOrEqual(result.candidates[0]?.signal.p95Duration ?? 0);
    expect(result.candidates[0]?.endpoint).toBe('GET /users');
    expect(result.candidates[0]?.recommendation.action).toBe('pagination');
  });

  it('requires enough samples', () => {
    const result = detectDatabaseResultSets(
      Array.from({ length: 4 }, (_, index) => sample(index, 2_000)),
    );

    expect(result.candidates).toEqual([]);
    expect(result.insufficientEvidence[0]?.reason).toBe('sample_count_below_minimum');
  });

  it('detects a result-set regression even when the absolute result size is below the large-result threshold', () => {
    const baseline = Array.from({ length: 10 }, (_, index) => sample(index, 100));
    const current = Array.from({ length: 10 }, (_, index) => sample(index + 10, 250));
    const result = detectDatabaseResultSets(current, baseline);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.signal.regressionDetected).toBe(true);
    expect(result.candidates[0]?.signal.p95RowsChangePercent).toBeGreaterThanOrEqual(100);
  });

  it('requires a meaningful large-result rate when there is no regression', () => {
    const result = detectDatabaseResultSets([
      sample(0, 2_000),
      sample(1, 2_000),
      sample(2, 500),
      sample(3, 500),
      sample(4, 500),
      sample(5, 500),
      sample(6, 500),
      sample(7, 500),
      sample(8, 500),
      sample(9, 500),
    ]);

    expect(result.candidates).toEqual([]);
  });

  it('keeps query fingerprints and database systems separate', () => {
    const result = detectDatabaseResultSets([
      ...Array.from({ length: 5 }, (_, index) => sample(index, 2_000)),
      ...Array.from({ length: 5 }, (_, index) => sample(index + 5, 2_000, { dbSystemName: 'mysql' })),
    ]);

    expect(result.candidates).toHaveLength(2);
    expect(new Set(result.candidates.map((candidate) => candidate.databaseSystem))).toEqual(new Set(['postgresql', 'mysql']));
  });

  it('reports DB-to-trace latency contribution when trace duration is available', () => {
    const result = detectDatabaseResultSets(
      Array.from({ length: 5 }, (_, index) => sample(index, 900, { duration: 300, traceDuration: 500 })),
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.signal.p95TraceContributionPercent).toBeGreaterThanOrEqual(50);
    expect(result.candidates[0]?.signal.evidenceReasons).toContain('database_time_is_material_to_trace_latency');
  });

  it('ignores non-database spans and missing row counts', () => {
    const result = detectDatabaseResultSets([
      sample(0, 2_000, { dependencyType: 'http' }),
      sample(1, 2_000, { returnedRows: undefined }),
      sample(2, 2_000, { dependencyType: 'http' }),
      sample(3, 2_000, { returnedRows: undefined }),
      sample(4, 2_000, { dependencyType: 'http' }),
    ]);

    expect(result.candidates).toEqual([]);
  });
});
