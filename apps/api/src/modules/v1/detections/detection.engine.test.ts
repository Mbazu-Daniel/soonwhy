import { describe, expect, it } from 'vitest';
import { DETECTION_RULES, evaluateSignal } from './detection.engine';

describe('evaluateSignal', () => {
  it('does not detect values below the configured threshold', () => {
    expect(evaluateSignal('latency', 999)).toBeUndefined();
    expect(evaluateSignal('error_rate', 4.99)).toBeUndefined();
  });

  it('classifies a latency threshold breach as warning', () => {
    expect(evaluateSignal('latency', 1_250)).toEqual({
      type: 'latency',
      observedValue: 1_250,
      threshold: DETECTION_RULES.latency.threshold,
      severity: 'warning',
      unit: 'ms',
    });
  });

  it('classifies a severe latency breach as critical', () => {
    expect(evaluateSignal('latency', 2_000)).toEqual({
      type: 'latency',
      observedValue: 2_000,
      threshold: DETECTION_RULES.latency.threshold,
      severity: 'critical',
      unit: 'ms',
    });
  });

  it('classifies an error-rate breach using the same deterministic rule', () => {
    expect(evaluateSignal('error_rate', 5)).toEqual({
      type: 'error_rate',
      observedValue: 5,
      threshold: DETECTION_RULES.error_rate.threshold,
      severity: 'warning',
      unit: '%',
    });

    expect(evaluateSignal('error_rate', 10)).toEqual({
      type: 'error_rate',
      observedValue: 10,
      threshold: DETECTION_RULES.error_rate.threshold,
      severity: 'critical',
      unit: '%',
    });
  });

  it('ignores non-finite observations', () => {
    expect(evaluateSignal('latency', Number.NaN)).toBeUndefined();
    expect(evaluateSignal('error_rate', Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});
