import { describe, expect, it, vi } from 'vitest';
import type { CorrelatedBottleneck } from './detection.correlation';
import { RcaService } from './rca.service';

describe('RcaService', () => {
  it('validates the provider response against supplied evidence', async () => {
    const provider = {
      analyze: vi.fn().mockResolvedValue({
        analysis: {
        summary: 'Database latency is contributing to checkout latency.',
        rootCause: 'The evidence points to the database dependency.',
        contributingFactors: ['Database latency increased.'],
        investigationSteps: ['Inspect the query plan.'],
        suggestedChanges: ['Candidate: review indexes and query shape.'],
        evidenceRefs: ['finding_latency:0', 'finding_dependency:0'],
        confidence: 'medium',
        limitations: ['The exact query plan is not established.'],
        },
        usage: { requestDurationMs: 12, retries: 0 },
        promptVersion: 'v2',
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
      supportingFindings: [{
        id: 'finding_dependency',
        projectId: 'project_123',
        serviceName: 'checkout-api',
        type: 'dependency_latency',
        severity: 'critical',
        title: 'Slow database dependency',
        description: 'database latency increased',
        observedValue: 900,
        threshold: 500,
        unit: 'ms',
        window: {
          start: new Date('2026-09-22T00:00:00.000Z'),
          end: new Date('2026-09-22T00:15:00.000Z'),
        },
        evidence: [{
          kind: 'metric',
          label: 'dependency-latency',
          value: 900,
        }],
      }],
      recommendation: 'Inspect the database query plan.',
      traceIds: [],
    } satisfies CorrelatedBottleneck;

    const service = new RcaService(provider);
    const result = await service.analyze('project_123', bottleneck);

    expect(provider.analyze).toHaveBeenCalledOnce();
    expect(provider.analyze.mock.calls[0]?.[0]).toMatchObject({
      projectId: 'project_123',
      serviceName: 'checkout-api',
    });
    expect(result.analysis.summary).toContain('Database latency');
  });

  it('rejects a provider response that references unavailable evidence', async () => {
    const provider = {
      analyze: vi.fn().mockResolvedValue({
        analysis: {
        summary: 'Checkout latency increased.',
        rootCause: 'Unknown.',
        contributingFactors: [],
        investigationSteps: [],
        suggestedChanges: [],
        evidenceRefs: ['invented:0'],
        confidence: 'low',
        limitations: ['Insufficient evidence.'],
        },
        usage: { requestDurationMs: 8, retries: 0 },
        promptVersion: 'v2',
      }),
    };

    const bottleneck = {
      serviceName: 'checkout-api',
      latency: {
        id: 'finding_latency',
        projectId: 'project_123',
        serviceName: 'checkout-api',
        type: 'latency',
        severity: 'warning',
        title: 'High latency',
        description: 'slow',
        observedValue: 1200,
        threshold: 1000,
        unit: 'ms',
        window: {
          start: new Date('2026-09-22T00:00:00.000Z'),
          end: new Date('2026-09-22T00:15:00.000Z'),
        },
        evidence: [],
      },
      supportingFindings: [],
      recommendation: 'Investigate the dominant operation.',
      traceIds: [],
    } satisfies CorrelatedBottleneck;

    const service = new RcaService(provider);

    await expect(service.analyze('project_123', bottleneck)).rejects.toThrow(
      'unknown evidence ID',
    );
  });
});
