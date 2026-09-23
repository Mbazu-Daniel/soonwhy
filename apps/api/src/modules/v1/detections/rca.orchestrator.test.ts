import { describe, expect, it, vi } from 'vitest';
import type { CorrelatedBottleneck } from './detection.correlation';
import { RcaOrchestrator } from './rca.orchestrator';
import type { RcaService } from './rca.service';

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
    const result = {
      analysis,
      usage: {
        requestDurationMs: 12,
        retries: 0,
      },
      promptVersion: 'v1',
    };
    const rcaService: Pick<RcaService, 'analyze'> = {
      analyze: vi.fn().mockResolvedValue(result),
    };
    const orchestrator = new RcaOrchestrator(rcaService);

    await expect(
      orchestrator.analyze('project_123', {
        serviceName: 'checkout-api',
        latency: {} as CorrelatedBottleneck['latency'],
        supportingFindings: [],
        recommendation: 'Inspect the dependency.',
        traceIds: [],
      }),
    ).resolves.toEqual(result);

    expect(rcaService.analyze).toHaveBeenCalledOnce();
  });
});
