import { describe, expect, it, vi } from 'vitest';
import type { CorrelatedBottleneck } from './detection.correlation';
import { RcaOrchestrator } from './rca.orchestrator';

describe('RcaOrchestrator', () => {
  it('delegates analysis to RcaService', async () => {
    const analysis = {
      summary: 'Latency increased.',
      rootCause: 'The evidence points to a slow dependency.',
      contributingFactors: [],
      investigationSteps: ['Inspect the dependency trace.'],
      suggestedChanges: [],
      evidenceRefs: ['finding_latency:0'],
      confidence: 'medium' as const,
      limitations: [],
    };
    const rcaService = {
      analyze: vi.fn().mockResolvedValue(analysis),
    };
    const provider = { analyze: vi.fn() };

    const orchestrator = new RcaOrchestrator(rcaService, provider);

    await expect(
      orchestrator.analyze(
        'project_123',
        {
          serviceName: 'checkout-api',
          latency: {} as CorrelatedBottleneck['latency'],
          supportingFindings: [],
          recommendation: 'Inspect the dependency.',
          traceIds: [],
        },
      ),
    ).resolves.toEqual(analysis);

    expect(rcaService.analyze).toHaveBeenCalledOnce();
  });

  it('reports provider configuration state', () => {
    const service = { analyze: vi.fn() };
    const provider = { analyze: vi.fn() };

    expect(new RcaOrchestrator(service, provider).isConfigured()).toBe(true);
  });
});
