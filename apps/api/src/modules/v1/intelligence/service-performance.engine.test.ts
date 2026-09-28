import { describe, expect, it } from 'vitest';
import { evaluateServicePerformance, type PerformanceWindow } from './service-performance.engine';

const sample: PerformanceWindow = {
  serviceName: 'api',
  endpoint: 'GET /users',
  sampleCount: 100,
  p50: 40,
  p95: 700,
  p99: 2_000,
  errorRate: 0.01,
  throughputPerMinute: 120,
};

describe('service performance engine', () => {
  it('keeps p50, p95 and p99 as one evidence set', () => {
    const signal = evaluateServicePerformance(sample);
    expect(signal?.latency).toMatchObject({ p50: 40, p95: 700, p99: 2_000 });
  });

  it('does not signal from an undersampled window', () => {
    expect(evaluateServicePerformance({ ...sample, sampleCount: 19 })).toBeUndefined();
  });

  it('correlates latency, errors and CPU into one signal', () => {
    const signal = evaluateServicePerformance({
      ...sample,
      p95: 1_200,
      errorRate: 0.12,
      cpuUtilization: 0.97,
    });

    expect(signal?.severity).toBe('critical');
    expect(signal?.reasons).toHaveLength(7);
  });

  it('records latency regression against a baseline', () => {
    const signal = evaluateServicePerformance(sample, {
      p50: 30,
      p95: 400,
      p99: 900,
      errorRate: 0.01,
      throughputPerMinute: 100,
    });

    expect(signal?.latency.p95ChangePercent).toBe(75);
    expect(signal?.latency.p99ChangePercent).toBeCloseTo(122.2222, 3);
  });
});
