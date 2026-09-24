import { describe, expect, it, vi } from 'vitest';
import type { CorrelatedBottleneck } from './detection.correlation';
import { RcaOrchestrator } from './rca.orchestrator';
import { RcaService } from './rca.service';

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
    const provider = { analyze: vi.fn().mockResolvedValue(analysis) };
    const rcaService = new RcaService(provider);
    const orchestrator = new RcaOrchestrator(rcaService);
    const now = new Date();
    const bottleneck: CorrelatedBottleneck = {
      serviceName: 'checkout-api',
      latency: {
        id: 'finding_latency', projectId: 'project_123', serviceName: 'checkout-api', type: 'latency', severity: 'warning',
        title: 'Latency increased', description: 'Latency is above the configured threshold.', observedValue: 900, threshold: 500, unit: 'ms',
        window: { start: new Date(now.getTime() - 60_000), end: now }, evidence: [],
      },
      supportingFindings: [], recommendation: 'Inspect the dependency.', traceIds: [],
    };
    await expect(orchestrator.analyze('project_123', bottleneck)).resolves.toEqual(analysis);
    expect(provider.analyze).toHaveBeenCalledOnce();
  });
});
