import { describe, expect, it } from 'vitest';
import { DETECTION_RULES, evaluateSignal, evaluateThroughput } from './detection.engine';

describe('evaluateSignal', () => {
  it('does not detect values below the threshold without a baseline regression', () => {
    expect(evaluateSignal('latency', 999)).toBeUndefined();
    expect(evaluateSignal('error_rate', 4.99)).toBeUndefined();
  });

  it('detects a latency threshold breach', () => {
    expect(evaluateSignal('latency', 1_250)).toEqual({
      type: 'latency',
      observedValue: 1_250,
      threshold: DETECTION_RULES.latency.threshold,
      severity: 'warning',
      unit: 'ms',
    });
  });

  it('detects a critical latency threshold breach', () => {
    expect(evaluateSignal('latency', 2_000)).toEqual({
      type: 'latency',
      observedValue: 2_000,
      threshold: DETECTION_RULES.latency.threshold,
      severity: 'critical',
      unit: 'ms',
    });
  });

  it('detects a latency regression below the absolute threshold', () => {
    expect(evaluateSignal('latency', 600, { value: 300, samples: 100 })).toEqual({
      type: 'latency',
      observedValue: 600,
      threshold: DETECTION_RULES.latency.threshold,
      severity: 'critical',
      unit: 'ms',
      baselineValue: 300,
      changePercent: 100,
    });
  });

  it('does not use a low-sample baseline for regression detection', () => {
    expect(evaluateSignal('latency', 400, { value: 300, samples: 19 })).toBeUndefined();
  });

  it('detects error-rate regression from a healthy baseline', () => {
    expect(evaluateSignal('error_rate', 3, { value: 1, samples: 100 })).toEqual({
      type: 'error_rate',
      observedValue: 3,
      threshold: DETECTION_RULES.error_rate.threshold,
      severity: 'critical',
      unit: '%',
      baselineValue: 1,
      changePercent: 200,
    });
  });

  it('classifies a large regression as critical', () => {
    expect(evaluateSignal('error_rate', 4, { value: 1, samples: 100 })?.severity).toBe('critical');
  });

  it('ignores non-finite observations', () => {
    expect(evaluateSignal('latency', Number.NaN)).toBeUndefined();
    expect(evaluateSignal('error_rate', Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

describe('evaluateThroughput', () => {
  it('detects a 30 percent throughput decrease', () => {
    expect(evaluateThroughput(70, { value: 100, samples: 100 })).toEqual({
      type: 'throughput',
      observedValue: 70,
      threshold: 70,
      severity: 'warning',
      unit: 'requests',
      baselineValue: 100,
      changePercent: -30,
    });
  });

  it('classifies a 50 percent throughput decrease as critical', () => {
    expect(evaluateThroughput(50, { value: 100, samples: 100 })?.severity).toBe('critical');
  });

  it('ignores small or low-sample throughput changes', () => {
    expect(evaluateThroughput(75, { value: 100, samples: 100 })).toBeUndefined();
    expect(evaluateThroughput(50, { value: 100, samples: 19 })).toBeUndefined();
  });

  it('ignores invalid throughput values and empty baselines', () => {
    expect(evaluateThroughput(Number.NaN, { value: 100, samples: 100 })).toBeUndefined();
    expect(evaluateThroughput(0, { value: 0, samples: 100 })).toBeUndefined();
  });
});
