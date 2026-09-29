import { describe, expect, it } from 'vitest';
import { detectDatabaseConnectionWait, type DatabaseConnectionWaitSample } from './database-connection-wait.detector';

const sample = (
  index: number,
  waitTimeMs: number,
  overrides: Partial<DatabaseConnectionWaitSample> = {},
): DatabaseConnectionWaitSample => ({
  timestamp: new Date(Date.parse('2026-09-29T04:00:00.000Z') + index * 60_000).toISOString(),
  service: 'checkout-api',
  poolName: 'primary',
  waitTimeMs,
  ...overrides,
});

describe('database connection wait detector', () => {
  it('detects sustained pool acquisition wait', () => {
    const result = detectDatabaseConnectionWait(
      Array.from({ length: 10 }, (_, index) => sample(index, 100 + index * 10)),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.signal.sampleCount).toBe(10);
    expect(result[0]?.signal.p50WaitMs).toBe(145);
    expect(result[0]?.signal.p95WaitMs).toBeGreaterThan(180);
    expect(result[0]?.signal.p99WaitMs).toBeGreaterThanOrEqual(result[0]?.signal.p95WaitMs ?? 0);
  });

  it('detects a wait-time regression against a healthy baseline', () => {
    const baseline = Array.from({ length: 10 }, (_, index) => sample(index, 10 + index));
    const current = Array.from({ length: 10 }, (_, index) => sample(index + 10, 30 + index * 2));
    const result = detectDatabaseConnectionWait(current, baseline);

    expect(result).toHaveLength(1);
    expect(result[0]?.signal.regressionDetected).toBe(true);
    expect(result[0]?.signal.p95ChangePercent).toBeGreaterThanOrEqual(100);
  });

  it('ignores healthy waits and insufficient samples', () => {
    expect(detectDatabaseConnectionWait(
      Array.from({ length: 9 }, (_, index) => sample(index, 10)),
    )).toEqual([]);

    expect(detectDatabaseConnectionWait(
      Array.from({ length: 10 }, (_, index) => sample(index, 20)),
    )).toEqual([]);
  });

  it('keeps services and pools isolated', () => {
    const result = detectDatabaseConnectionWait([
      ...Array.from({ length: 10 }, (_, index) => sample(index, 100)),
      ...Array.from({ length: 10 }, (_, index) => sample(index + 10, 10, { poolName: 'replica' })),
      ...Array.from({ length: 10 }, (_, index) => sample(index + 20, 100, { service: 'worker' })),
    ]);

    expect(result).toHaveLength(2);
    expect(new Set(result.map((candidate) => candidate.serviceName + ':' + candidate.poolName))).toEqual(
      new Set(['checkout-api:primary', 'worker:primary']),
    );
  });

  it('ignores invalid samples', () => {
    const result = detectDatabaseConnectionWait([
      sample(0, -1),
      sample(1, Number.NaN),
      sample(2, 100),
    ]);

    expect(result).toEqual([]);
  });
});
