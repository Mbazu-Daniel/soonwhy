import { describe, expect, it } from 'vitest';
import { detectNPlusOne, type NPlusOneTrace } from './n-plus-one.detector';

function sample(overrides: Partial<NPlusOneTrace> = {}): NPlusOneTrace {
  return {
    timestamp: '2026-09-28T10:00:00.000Z',
    service: 'api',
    traceId: 'trace-1',
    spanId: 'span-1',
    parentSpanId: 'request-1',
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

describe('N+1 detector', () => {
  it('detects repeated equivalent queries inside one parent span', () => {
    const candidates = detectNPlusOne([
      sample({ spanId: 'span-1', duration: 20 }),
      sample({ spanId: 'span-2', duration: 25 }),
      sample({ spanId: 'span-3', duration: 30 }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.signal.occurrences).toBe(3);
    expect(candidates[0]?.signal.totalDurationMs).toBe(75);
    expect(candidates[0]?.signal.p50DurationMs).toBe(25);
    expect(candidates[0]?.signal.p95DurationMs).toBe(29.5);
    expect(candidates[0]?.identity.fingerprint).toBeDefined();
  });

  it('does not combine the same query across traces', () => {
    const candidates = detectNPlusOne([
      sample({ traceId: 'trace-1', spanId: 'span-1' }),
      sample({ traceId: 'trace-1', spanId: 'span-2' }),
      sample({ traceId: 'trace-2', spanId: 'span-3' }),
      sample({ traceId: 'trace-2', spanId: 'span-4' }),
    ]);

    expect(candidates).toEqual([]);
  });

  it('does not combine queries under different parent spans', () => {
    const candidates = detectNPlusOne([
      sample({ spanId: 'span-1', parentSpanId: 'parent-1' }),
      sample({ spanId: 'span-2', parentSpanId: 'parent-1' }),
      sample({ spanId: 'span-3', parentSpanId: 'parent-2' }),
      sample({ spanId: 'span-4', parentSpanId: 'parent-2' }),
    ]);

    expect(candidates).toEqual([]);
  });

  it('ignores batched database spans', () => {
    const candidates = detectNPlusOne([
      sample({ spanId: 'span-1', dbBatchSize: 3 }),
      sample({ spanId: 'span-2', dbBatchSize: 3 }),
      sample({ spanId: 'span-3', dbBatchSize: 3 }),
    ]);

    expect(candidates).toEqual([]);
  });

  it('requires meaningful repeated work', () => {
    const candidates = detectNPlusOne([
      sample({ spanId: 'span-1', duration: 5 }),
      sample({ spanId: 'span-2', duration: 5 }),
      sample({ spanId: 'span-3', duration: 5 }),
    ]);

    expect(candidates).toEqual([]);
  });
});
