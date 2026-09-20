import { describe, expect, it } from 'vitest';
import { DETECTION_RULES, evaluateSignal } from './detection.engine';

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
      severity: 'warning',
      unit: 'ms',
      baselineValue: 300,
      changePercent: 100,
    });
  });

  it('does not use a low-sample baseline', () => {
    expect(evaluateSignal('latency', 600, { value: 300, samples: 19 })).toBeUndefined();
  });

  it('detects error-rate regression from a healthy baseline', () => {
    expect(evaluateSignal('error_rate', 3, { value: 1, samples: 100 })).toEqual({
      type: 'error_rate',
      observedValue: 3,
      threshold: DETECTION_RULES.error_rate.threshold,
      severity: 'warning',
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
