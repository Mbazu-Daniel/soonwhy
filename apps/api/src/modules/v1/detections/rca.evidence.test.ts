import { describe, expect, it } from 'vitest';
import type { CorrelatedBottleneck } from './detection.correlation';
import { buildRcaEvidence } from './rca.evidence';

describe('buildRcaEvidence', () => {
  it('preserves deterministic findings and separates trace and recommendation evidence', () => {
    const bottleneck: CorrelatedBottleneck = {
      serviceName: 'checkout-api',
      latency: {
        id: 'finding_latency',
        projectId: 'project_123',
        serviceName: 'checkout-api',
        type: 'latency',
        severity: 'critical',
        title: 'High latency detected',
        description: 'p95 latency increased',
        observedValue: 1600,
        threshold: 1000,
        unit: 'ms',
        window: {
          start: new Date('2026-09-22T00:00:00.000Z'),
          end: new Date('2026-09-22T00:15:00.000Z'),
        },
        evidence: [
          {
            kind: 'request',
            label: 'slow-request',
            value: 1600,
            context: {
              traceId: 'trace_123',
              baselineValue: 700,
              changePercent: 128.6,
            },
          },
        ],
      },
      supportingFindings: [
        {
          id: 'finding_dependency',
          projectId: 'project_123',
          serviceName: 'checkout-api',
          type: 'dependency_latency',
          severity: 'critical',
          title: 'Slow database dependency',
          description: 'postgres is slow',
          observedValue: 900,
          threshold: 500,
          unit: 'ms',
          window: {
            start: new Date('2026-09-22T00:00:00.000Z'),
            end: new Date('2026-09-22T00:15:00.000Z'),
          },
          evidence: [
            {
              kind: 'trace',
              label: 'slow-dependency-span',
              value: 900,
              context: {
                traceId: 'trace_123',
                spanId: 'span_456',
                dependencyType: 'database',
                dependencyName: 'postgres',
              },
            },
            {
              kind: 'recommendation',
              label: 'optimization-guidance',
              value: 'Inspect the query shape and database plan first.',
            },
          ],
        },
      ],
      recommendation: 'Inspect the query shape and database plan first.',
      dependencyType: 'database',
      dependencyName: 'postgres',
      traceIds: ['trace_123'],
    };

    const evidence = buildRcaEvidence('project_123', bottleneck);

    expect(evidence.projectId).toBe('project_123');
    expect(evidence.serviceName).toBe('checkout-api');
    expect(evidence.severity).toBe('critical');
    expect(evidence.primaryFinding.context).toMatchObject({
      baselineValue: 700,
      changePercent: 128.6,
    });
    expect(evidence.traces).toHaveLength(1);
    expect(evidence.traces[0]?.context).toMatchObject({
      traceId: 'trace_123',
      spanId: 'span_456',
    });
    expect(evidence.recommendations.map((item) => item.value)).toContain(
      'Inspect the query shape and database plan first.',
    );
    expect(evidence.supportingFindings).toHaveLength(0);
  });
});
