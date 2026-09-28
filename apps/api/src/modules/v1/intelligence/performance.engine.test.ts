import { describe, expect, it } from 'vitest';
import {
  compareImpact,
  evaluateLatency,
  evaluatePersistence,
  evaluateThroughput,
  evaluateTraceContribution,
} from './performance.engine';

describe('performance intelligence', () => {
  it('does not promote a weak baseline to a regression', () => {
    const signal = evaluateLatency(1500, { value: 800, samples: 10 });
    expect(signal?.severity).toBe('candidate');
  });

  it('detects material latency regression with a sufficiently sampled baseline', () => {
    const signal = evaluateLatency(1600, { value: 800, samples: 100 });
    expect(signal).toMatchObject({
      metric: 'latency',
      severity: 'critical',
      baselineValue: 800,
      changePercent: 100,
    });
  });

  it('detects throughput degradation', () => {
    const signal = evaluateThroughput(600, { value: 1000, samples: 100 });
    expect(signal?.severity).toBe('critical');
    expect(signal?.changePercent).toBe(-40);
  });

  it('detects dominant trace spans without exceeding trace duration', () => {
    expect(evaluateTraceContribution(800, 1000)?.severity).toBe('critical');
    expect(evaluateTraceContribution(1200, 1000)).toBeUndefined();
  });

  it('compares affected and unaffected populations', () => {
    const impact = compareImpact(
      { value: 1800, samples: 50 },
      { value: 900, samples: 100 },
    );
    expect(impact?.ratio).toBe(2);
  });

  it('requires repeated windows before calling a signal persistent', () => {
    const result = evaluatePersistence(
      [
        { start: '1', end: '2', value: 100, samples: 20 },
        { start: '2', end: '3', value: 120, samples: 20 },
        { start: '3', end: '4', value: 130, samples: 20 },
      ],
      (window) => window.value >= 100,
      3,
    );

    expect(result).toEqual({ windows: 3, requiredWindows: 3, persistent: true });
  });
});
