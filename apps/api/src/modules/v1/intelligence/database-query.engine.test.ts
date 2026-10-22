import { describe, expect, it } from 'vitest';
import { evaluateDatabaseQuery, percentile } from './database-query.engine';

describe('database query engine', () => {
  it('detects a slow query from its p95 latency', () => {
    const signal = evaluateDatabaseQuery(720, undefined, 0);

    expect(signal).toMatchObject({
      severity: 'warning',
      observedValue: 720,
      threshold: 500,
    });
  });

  it('promotes a materially slow query to critical', () => {
    const signal = evaluateDatabaseQuery(1_250, undefined, 0);

    expect(signal?.severity).toBe('critical');
  });

  it('detects a query regression when the absolute and relative gates are met', () => {
    const signal = evaluateDatabaseQuery(600, 300, 50);

    expect(signal).toMatchObject({
      severity: 'warning',
      baselineValue: 300,
      changePercent: 100,
    });
  });

  it('does not use an undersampled baseline', () => {
    const signal = evaluateDatabaseQuery(480, 300, 19);

    expect(signal).toBeUndefined();
  });

  it('calculates a bounded percentile', () => {
    expect(percentile([100, 300, 200, 400], 0.95)).toBe(385);
    expect(percentile([], 0.95)).toBeUndefined();
  });
});
