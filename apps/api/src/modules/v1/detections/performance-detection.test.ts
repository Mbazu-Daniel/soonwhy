import { describe, expect, it } from 'vitest';
import { evaluateEndpointPerformance } from './performance-detection';

describe('evaluateEndpointPerformance', () => {
  it('converts request statistics into a performance finding', () => {
    const result = evaluateEndpointPerformance(
      {
        serviceName: 'checkout-api',
        endpointName: 'POST /checkout',
        sampleCount: 50,
        p95Duration: 300,
        throughputPerMinute: 50,
        errorRate: 0.2,
      },
      {
        serviceName: 'checkout-api',
        endpointName: 'POST /checkout',
        sampleCount: 50,
        p95Duration: 100,
        throughputPerMinute: 100,
        errorRate: 0.02,
      },
    );

    expect(result).toMatchObject({
      serviceName: 'checkout-api',
      endpointName: 'POST /checkout',
      confidence: 'high',
      signals: [
        'latency',
        'latency_regression',
        'throughput_regression',
        'error_regression',
      ],
    });
  });

  it('does not evaluate an endpoint with insufficient samples', () => {
    expect(
      evaluateEndpointPerformance({
        serviceName: 'checkout-api',
        endpointName: 'GET /checkout',
        sampleCount: 9,
        p95Duration: 500,
        throughputPerMinute: 9,
        errorRate: 0,
      }),
    ).toBeNull();
  });
});
