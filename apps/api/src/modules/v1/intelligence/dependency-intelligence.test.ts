import { describe, expect, it } from 'vitest';
import { evaluateDependency } from './dependency-intelligence';

describe('evaluateDependency', () => {
  it('requires a minimum sample count', () => {
    expect(evaluateDependency({
      serviceName: 'orders',
      dependencyType: 'queue',
      dependencyName: 'orders',
      sampleCount: 4,
      p95Duration: 400,
    })).toBeNull();
  });

  it('keeps dependency types separate in the identity', () => {
    const database = evaluateDependency({
      serviceName: 'orders',
      dependencyType: 'database',
      dependencyName: 'orders-db',
      sampleCount: 10,
      p95Duration: 200,
    });
    const cache = evaluateDependency({
      serviceName: 'orders',
      dependencyType: 'cache',
      dependencyName: 'orders-db',
      sampleCount: 10,
      p95Duration: 200,
    });

    expect(database?.identity.fingerprint).not.toBe(cache?.identity.fingerprint);
  });

  it('correlates latency and errors with high confidence', () => {
    const result = evaluateDependency({
      serviceName: 'orders',
      dependencyType: 'queue',
      dependencyName: 'orders',
      operationName: 'consume',
      sampleCount: 20,
      p95Duration: 400,
      baselineP95Duration: 100,
      errorRate: 0.2,
      baselineErrorRate: 0.02,
    });

    expect(result).toMatchObject({
      confidence: 'high',
      signals: ['latency', 'latency_regression', 'errors', 'error_regression'],
      dependencyType: 'queue',
      dependencyName: 'orders',
      operationName: 'consume',
    });
  });

  it('detects throughput regression without inventing queue depth', () => {
    const result = evaluateDependency({
      serviceName: 'orders-worker',
      dependencyType: 'queue',
      dependencyName: 'orders',
      sampleCount: 20,
      throughputPerMinute: 50,
      baselineThroughputPerMinute: 100,
    });

    expect(result?.signals).toEqual(['throughput_regression']);
  });

  it('does not create a finding for a stable dependency', () => {
    expect(evaluateDependency({
      serviceName: 'orders',
      dependencyType: 'http',
      dependencyName: 'payments',
      sampleCount: 100,
      p95Duration: 40,
      baselineP95Duration: 42,
      errorRate: 0.01,
      baselineErrorRate: 0.01,
      throughputPerMinute: 100,
      baselineThroughputPerMinute: 98,
    })).toBeNull();
  });
});
