import { describe, expect, it } from 'vitest';
import { evaluatePerformance } from './performance-intelligence';

describe('evaluatePerformance', () => {
  it('detects latency and error regression with high confidence', () => {
    const result = evaluatePerformance({
      serviceName: 'orders',
      endpointName: 'POST /checkout',
      sampleCount: 50,
      baselineSampleCount: 50,
      p95Duration: 300,
      baselineP95Duration: 100,
      errorRate: 0.2,
      baselineErrorRate: 0.02,
    });
    expect(result).toMatchObject({
      confidence: 'high',
      signals: ['latency', 'latency_regression', 'error_regression'],
    });
  });

  it('rejects insufficient samples and invalid rates', () => {
    expect(evaluatePerformance({ serviceName: 'orders', endpointName: 'GET /orders', sampleCount: 9, p95Duration: 500 })).toBeNull();
    expect(evaluatePerformance({ serviceName: 'orders', endpointName: 'GET /orders', sampleCount: 20, errorRate: 2 })).toBeNull();
  });
});
