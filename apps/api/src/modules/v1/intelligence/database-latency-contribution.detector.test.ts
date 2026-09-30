import { describe, expect, it } from 'vitest';
import {
  detectDatabaseLatencyContribution,
  type DatabaseLatencyContributionTrace,
} from './database-latency-contribution.detector';

function sample(overrides: Partial<DatabaseLatencyContributionTrace> = {}): DatabaseLatencyContributionTrace {
  return {
    timestamp: '2026-09-28T10:00:00.000Z',
    service: 'api',
    traceId: 'trace-1',
    spanId: 'span-1',
    duration: 300,
    traceDuration: 500,
    dependencyType: 'database',
    dependencyName: 'postgresql',
    dbQueryText: 'SELECT * FROM users WHERE id = ?',
    dbQuerySummary: 'SELECT users',
    dbOperationName: 'SELECT',
    dbSystemName: 'postgresql',
    ...overrides,
  };
}

describe('database latency contribution detector', () => {
  it('detects a query that dominates request latency', () => {
    const traces = Array.from({ length: 12 }, (_, index) =>
      sample({
        traceId: 'trace-' + index,
        spanId: 'span-' + index,
        duration: 300 + (index % 2) * 20,
        traceDuration: 500,
      }),
    );

    const candidates = detectDatabaseLatencyContribution(traces);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.signal.sampleCount).toBe(12);
    expect(candidates[0]?.signal.p95ContributionPercent).toBeGreaterThan(50);
    expect(candidates[0]?.signal.p95DurationMs).toBeGreaterThan(300);
  });

  it('aggregates repeated query spans within one trace', () => {
    const traces = Array.from({ length: 10 }, (_, index) => [
      sample({ traceId: 'trace-' + index, spanId: 'span-a-' + index, duration: 140, traceDuration: 400 }),
      sample({ traceId: 'trace-' + index, spanId: 'span-b-' + index, duration: 100, traceDuration: 400 }),
    ]).flat();

    expect(detectDatabaseLatencyContribution(traces)).toHaveLength(1);
  });

  it('requires enough trace observations', () => {
    expect(detectDatabaseLatencyContribution(
      Array.from({ length: 9 }, (_, index) => sample({
        traceId: 'trace-' + index,
        spanId: 'span-' + index,
      })),
    )).toEqual([]);
  });

  it('ignores database work that is not a meaningful share of the trace', () => {
    expect(detectDatabaseLatencyContribution(
      Array.from({ length: 12 }, (_, index) => sample({
        traceId: 'trace-' + index,
        spanId: 'span-' + index,
        duration: 100,
        traceDuration: 1_000,
      })),
    )).toEqual([]);
  });

  it('keeps query identities isolated', () => {
    const first = Array.from({ length: 10 }, (_, index) => sample({
      traceId: 'pg-' + index,
      spanId: 'pg-span-' + index,
      dbSystemName: 'postgresql',
    }));
    const second = Array.from({ length: 10 }, (_, index) => sample({
      traceId: 'mysql-' + index,
      spanId: 'mysql-span-' + index,
      dbSystemName: 'mysql',
    }));

    expect(detectDatabaseLatencyContribution([...first, ...second])).toHaveLength(2);
  });

  it('ignores invalid trace duration relationships', () => {
    expect(detectDatabaseLatencyContribution([
      sample({ duration: 600, traceDuration: 500 }),
      ...Array.from({ length: 9 }, (_, index) => sample({
        traceId: 'trace-' + (index + 1),
        spanId: 'span-' + (index + 1),
      })),
    ])).toEqual([]);
  });
});
