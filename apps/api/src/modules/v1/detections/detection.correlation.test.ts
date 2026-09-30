import { describe, expect, it } from 'vitest';
import { correlateFindings } from './detection.correlation';
import type { DetectionFinding } from './detection.types';

const window = {
  start: new Date('2026-09-20T18:00:00.000Z'),
  end: new Date('2026-09-20T18:15:00.000Z'),
};

function finding(overrides: Partial<DetectionFinding> = {}): DetectionFinding {
  return {
    id: 'finding-1',
    projectId: 'project-1',
    serviceName: 'checkout',
    type: 'latency',
    severity: 'warning',
    title: 'High latency detected in checkout',
    description: 'Request latency is elevated.',
    observedValue: 1_500,
    threshold: 1_000,
    unit: 'ms',
    window,
    evidence: [],
    ...overrides,
  };
}

describe('correlateFindings', () => {
  it('correlates request latency with a slow database dependency', () => {
    const result = correlateFindings([
      finding(),
      finding({
        id: 'finding-2',
        type: 'dependency_latency',
        title: 'Slow database dependency in checkout',
        observedValue: 900,
        evidence: [{
          kind: 'recommendation',
          label: 'optimization-guidance',
          value: 'Inspect the database query shape.',
          context: {
            dependencyType: 'database',
            dependencyName: 'postgres',
          },
        }],
      }),
      finding({
        id: 'finding-3',
        type: 'throughput',
        observedValue: 60,
        threshold: 70,
        unit: 'requests',
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      serviceName: 'checkout',
      latency: { id: 'finding-1' },
      supportingFindings: [
        { id: 'finding-2', type: 'dependency_latency' },
        { id: 'finding-3', type: 'throughput' },
      ],
      dependencyType: 'database',
      dependencyName: 'postgres',
    });
    expect(result[0]?.recommendation).toContain('database query shape');
  });

  it('correlates trace evidence when no dependency finding exists', () => {
    const result = correlateFindings([
      finding(),
      finding({
        id: 'finding-2',
        type: 'trace_span',
        evidence: [{
          kind: 'trace',
          label: 'dominant-span',
          value: 900,
          context: {
            traceId: 'trace-1',
            spanId: 'span-1',
          },
        }],
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.traceIds).toEqual(['trace-1']);
  });

  it('does not create a correlated finding from an isolated signal', () => {
    expect(correlateFindings([finding()])).toEqual([]);
  });
});


describe('trace-aware dependency correlation', () => {
  it('does not correlate an unrelated dependency when request trace identity is known', () => {
    const result = correlateFindings([
      finding({
        evidence: [{
          kind: 'request',
          label: 'slow-request',
          value: 1_600,
          context: { traceId: 'trace-checkout-001' },
        }],
      }),
      finding({
        id: 'finding-2',
        type: 'dependency_latency',
        evidence: [
          {
            kind: 'trace',
            label: 'slow-dependency-span',
            value: 1_200,
            context: {
              traceId: 'trace-unrelated-002',
              dependencyType: 'database',
              dependencyName: 'postgres',
            },
          },
          {
            kind: 'recommendation',
            label: 'optimization-guidance',
            value: 'database guidance',
            context: {
              dependencyType: 'database',
              dependencyName: 'postgres',
            },
          },
        ],
      }),
      finding({
        id: 'finding-3',
        type: 'trace_span',
        evidence: [{
          kind: 'trace',
          label: 'dominant-span',
          value: 1_500,
          context: { traceId: 'trace-checkout-001' },
        }],
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.supportingFindings.map((item) => item.type)).toEqual(['trace_span']);
    expect(result[0]?.traceIds).toEqual(['trace-checkout-001']);
  });
});
