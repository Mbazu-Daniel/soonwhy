import { describe, expect, it } from 'vitest';
import { detectExternalDependencyDegradation, type ExternalDependencyTrace } from './external-dependency-degradation.detector';

const sample = (overrides: Partial<ExternalDependencyTrace> = {}): ExternalDependencyTrace => ({
  timestamp: '2026-09-29T08:00:00.000Z',
  service: 'checkout-api',
  traceId: crypto.randomUUID(),
  spanId: crypto.randomUUID(),
  duration: 600,
  dependencyType: 'http',
  dependencyName: 'payments-api',
  ...overrides,
});

describe('detectExternalDependencyDegradation', () => {
  it('requires multiple degradation signals', () => {
    const result = detectExternalDependencyDegradation(
      Array.from({ length: 5 }, () => sample({ duration: 600 })),
      [],
    );
    expect(result).toHaveLength(0);
  });

  it('detects correlated latency and error degradation', () => {
    const result = detectExternalDependencyDegradation(
      Array.from({ length: 5 }, (_, index) => sample({
        duration: 600 + index * 10,
        statusCode: index < 2 ? 503 : 200,
      })),
      [],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      serviceName: 'checkout-api',
      dependencyType: 'http',
      dependencyName: 'payments-api',
      signal: {
        errorCount: 2,
        degradationSignals: ['latency', 'errors'],
      },
    });
  });

  it('detects latency regression against a comparable baseline', () => {
    const result = detectExternalDependencyDegradation(
      Array.from({ length: 5 }, () => sample({ duration: 180 })),
      Array.from({ length: 5 }, () => sample({ duration: 100 })),
    );

    expect(result).toHaveLength(0);

    const degraded = detectExternalDependencyDegradation(
      Array.from({ length: 5 }, (_, index) => sample({ duration: 600 + index * 10, errorType: 'timeout' })),
      Array.from({ length: 5 }, () => sample({ duration: 100 })),
    );
    expect(degraded[0]?.signal.p95DurationChangePercent).toBeGreaterThanOrEqual(50);
  });

  it('keeps HTTP and RPC dependencies separate', () => {
    const result = detectExternalDependencyDegradation(
      [
        ...Array.from({ length: 5 }, () => sample({ dependencyType: 'http', duration: 600, statusCode: 503 })),
        ...Array.from({ length: 5 }, () => sample({ dependencyType: 'rpc', duration: 600, statusCode: 2 })),
      ],
      [],
    );
    expect(result).toHaveLength(2);
    expect(result.map((candidate) => candidate.dependencyType)).toEqual(['http', 'rpc']);
  });
});
