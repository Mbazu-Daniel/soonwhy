import { describe, expect, it } from 'vitest';
import {
  detectDatabaseQueryVolume,
  type DatabaseQueryVolumeTrace,
} from './database-query-volume.detector';

function sample(overrides: Partial<DatabaseQueryVolumeTrace> = {}): DatabaseQueryVolumeTrace {
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

function samples(count: number, prefix: string): DatabaseQueryVolumeTrace[] {
  return Array.from({ length: count }, (_, index) =>
    sample({ traceId: prefix + '-trace-' + index, spanId: prefix + '-span-' + index }),
  );
}

describe('database query volume detector', () => {
  it('detects a significant query volume increase', () => {
    const candidates = detectDatabaseQueryVolume(samples(60, 'current'), samples(25, 'baseline'));

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.signal.currentCount).toBe(60);
    expect(candidates[0]?.signal.baselineCount).toBe(25);
    expect(candidates[0]?.signal.absoluteIncrease).toBe(35);
    expect(candidates[0]?.signal.relativeIncrease).toBe(1.4);
  });

  it('does not report a small increase', () => {
    expect(
      detectDatabaseQueryVolume(samples(40, 'current'), samples(25, 'baseline')),
    ).toEqual([]);
  });

  it('requires enough baseline evidence', () => {
    expect(
      detectDatabaseQueryVolume(samples(60, 'current'), samples(10, 'baseline')),
    ).toEqual([]);
  });

  it('keeps query identity scoped by service and database system', () => {
    const current = samples(60, 'current').map((item) => ({
      ...item,
      service: 'worker',
      dbSystemName: 'mysql',
    }));
    const baseline = samples(25, 'baseline').map((item) => ({
      ...item,
      service: 'api',
      dbSystemName: 'postgresql',
    }));

    expect(detectDatabaseQueryVolume(current, baseline)).toEqual([]);
  });

  it('ignores non-database spans', () => {
    expect(
      detectDatabaseQueryVolume(
        samples(60, 'current').map((item) => ({ ...item, dependencyType: 'http' })),
        samples(25, 'baseline'),
      ),
    ).toEqual([]);
  });
});
