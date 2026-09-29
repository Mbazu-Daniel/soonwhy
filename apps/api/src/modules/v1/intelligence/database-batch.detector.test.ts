import { describe, expect, it } from 'vitest';
import { detectDatabaseBatches, type DatabaseBatchTrace } from './database-batch.detector';

const sample = (
  index: number,
  batchSize: number,
  overrides: Partial<DatabaseBatchTrace> = {},
): DatabaseBatchTrace => ({
  timestamp: new Date(Date.parse('2026-09-29T04:00:00.000Z') + index * 60_000).toISOString(),
  service: 'checkout-api',
  traceId: 'trace-' + index,
  spanId: 'span-' + index,
  duration: 100 + batchSize * 10,
  traceDuration: 500,
  dependencyType: 'database',
  dependencyName: 'postgresql',
  batchSize,
  dbQueryText: 'INSERT INTO orders (id) VALUES (?)',
  dbSystemName: 'postgresql',
  endpoint: 'POST /orders',
  ...overrides,
});

describe('database batch detector', () => {
  it('detects a batch duration regression against a comparable baseline', () => {
    const baseline = Array.from({ length: 10 }, (_, index) => sample(index, 2));
    const current = Array.from({ length: 10 }, (_, index) => sample(index + 10, 4, { duration: 220 }));

    const result = detectDatabaseBatches(current, baseline);

    expect(result).toHaveLength(1);
    expect(result[0]?.signal.regressionDetected).toBe(true);
    expect(result[0]?.signal.p95BatchSizeChangePercent).toBe(100);
    expect(result[0]?.identity.fingerprint).toBeTruthy();
  });

  it('correlates batch work with trace contribution', () => {
    const result = detectDatabaseBatches(
      Array.from({ length: 5 }, (_, index) => sample(index, 10, { duration: 300, traceDuration: 500 })),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.signal.traceContributionDetected).toBe(true);
    expect(result[0]?.signal.p95TraceContributionPercent).toBeGreaterThanOrEqual(50);
    expect(result[0]?.signal.logicalOperationCount).toBe(50);
  });

  it('requires actual batch telemetry', () => {
    const result = detectDatabaseBatches(
      Array.from({ length: 10 }, (_, index) => sample(index, 1)),
    );

    expect(result).toEqual([]);
  });

  it('requires enough batch observations', () => {
    const result = detectDatabaseBatches(
      Array.from({ length: 4 }, (_, index) => sample(index, 10, { duration: 300, traceDuration: 500 })),
    );

    expect(result).toEqual([]);
  });

  it('keeps query fingerprints and database systems isolated', () => {
    const result = detectDatabaseBatches([
      ...Array.from({ length: 5 }, (_, index) => sample(index, 4)),
      ...Array.from({ length: 5 }, (_, index) => sample(index + 5, 4, { dbSystemName: 'mysql' })),
    ]);

    expect(result).toEqual([]);
    const resultWithContribution = detectDatabaseBatches([
      ...Array.from({ length: 5 }, (_, index) => sample(index, 4, { duration: 300, traceDuration: 500 })),
      ...Array.from({ length: 5 }, (_, index) => sample(index + 5, 4, { dbSystemName: 'mysql', duration: 300, traceDuration: 500 })),
    ]);

    expect(resultWithContribution).toHaveLength(2);
    expect(new Set(resultWithContribution.map((candidate) => candidate.databaseSystem))).toEqual(new Set(['postgresql', 'mysql']));
  });
});
