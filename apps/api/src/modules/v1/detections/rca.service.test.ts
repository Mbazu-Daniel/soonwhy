import { describe, expect, it, vi } from 'vitest';
import type { CorrelatedBottleneck } from './detection.correlation';
import { RcaService } from './rca.service';

describe('RcaService', () => {
  it('passes the structured evidence contract to the provider', async () => {
    const provider = {
      analyze: vi.fn().mockResolvedValue({
        summary: 'Database latency is contributing to checkout latency.',
        rootCause: 'The evidence points to the database dependency.',
        contributingFactors: [],
        investigationSteps: ['Inspect the query plan.'],
        suggestedChanges: ['Review indexes and query shape.'],
        evidenceRefs: ['finding_dependency:0'],
        confidence: 'medium',
        limitations: [],
      }),
    };

    const bottleneck = {
      serviceName: 'checkout-api',
      latency: {
        id: 'finding_latency',
        projectId: 'project_123',
        serviceName: 'checkout-api',
        type: 'latency',
        severity: 'critical',
        title: 'High latency',
        description: 'slow',
        observedValue: 1600,
        threshold: 1000,
        unit: 'ms',
        window: {
          start: new Date('2026-09-22T00:00:00.000Z'),
          end: new Date('2026-09-22T00:15:00.000Z'),
        },
        evidence: [],
      },
      supportingFindings: [],
      recommendation: 'Inspect the dominant operation.',
      traceIds: [],
    } satisfies CorrelatedBottleneck;

    const service = new RcaService(provider);
    const result = await service.analyze('project_123', bottleneck);

    expect(provider.analyze).toHaveBeenCalledOnce();
    expect(provider.analyze.mock.calls[0]?.[0]).toMatchObject({
      projectId: 'project_123',
      serviceName: 'checkout-api',
    });
    expect(result.summary).toContain('Database latency');
  });
});
