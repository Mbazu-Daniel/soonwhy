import { describe, expect, it } from 'vitest';
import { evaluateEndpointPerformance } from './performance-detection';

describe('evaluateEndpointPerformance', () => {
  it('maps current and baseline endpoint statistics', () => {
    const result = evaluateEndpointPerformance(
      { serviceName: 'orders', endpointName: 'GET /orders', sampleCount: 20, p95Duration: 300, throughputPerMinute: 50, errorRate: 0.2 },
      { serviceName: 'orders', endpointName: 'GET /orders', sampleCount: 20, p95Duration: 100, throughputPerMinute: 100, errorRate: 0.02 },
    );
    expect(result?.confidence).toBe('high');
  });
});
