import { describe, expect, it, vi } from 'vitest';
import { RcaApiService } from './rca.api';

function finding(overrides: Record<string, unknown> = {}) {
  return {
    id: 'finding_1',
    orgId: 'org_1',
    projectId: 'project_1',
    serviceName: 'checkout-api',
    type: 'bottleneck',
    severity: 'critical',
    title: 'Correlated bottleneck',
    description: 'Latency correlates with a dependency.',
    observedValue: 1600,
    threshold: 1000,
    unit: 'ms',
    windowStart: new Date('2026-09-22T10:00:00Z'),
    windowEnd: new Date('2026-09-22T10:15:00Z'),
    evidence: [
      {
        kind: 'metric',
        label: 'correlated-signal',
        value: 1600,
        context: { sourceFindingId: 'latency_1' },
      },
      {
        kind: 'metric',
        label: 'supporting-finding',
        value: 900,
        context: {
          findingId: 'dependency_1',
          findingType: 'dependency_latency',
          severity: 'critical',
          service: 'checkout-api',
        },
      },
      {
        kind: 'trace',
        label: 'correlated-trace',
        value: 'trace_1',
        context: { traceId: 'trace_1' },
      },
      {
        kind: 'recommendation',
        label: 'optimization-guidance',
        value: 'Inspect the database query plan.',
        context: { dependencyType: 'database', dependencyName: 'postgres' },
      },
    ],
    ...overrides,
  };
}

describe('RcaApiService', () => {
  it('returns an existing analysis without calling the provider', async () => {
    const existing = { id: 'rca_1' };
    const repository = { findFinding: vi.fn().mockResolvedValue(finding()) };
    const persistence = {
      findLatest: vi.fn().mockResolvedValue(existing),
      list: vi.fn(),
      persist: vi.fn(),
    };
    const orchestrator = { analyze: vi.fn() };
    const service = new RcaApiService(repository, orchestrator, persistence);

    await expect(service.generate('org_1', 'project_1', 'finding_1', false)).resolves.toEqual(existing);
    expect(orchestrator.analyze).not.toHaveBeenCalled();
  });

  it('generates and persists an RCA when regeneration is requested', async () => {
    const analysis = {
      summary: 'Latency increased.',
      rootCause: 'Slow database dependency.',
      contributingFactors: [],
      investigationSteps: ['Inspect the query plan.'],
      suggestedChanges: ['Review indexes.'],
      evidenceRefs: ['latency_1:0'],
      confidence: 'high' as const,
      limitations: [],
    };
    const persisted = { id: 'rca_2', ...analysis };
    const repository = { findFinding: vi.fn().mockResolvedValue(finding()) };
    const persistence = {
      findLatest: vi.fn().mockResolvedValue({ id: 'rca_1' }),
      list: vi.fn(),
      persist: vi.fn().mockResolvedValue(persisted),
    };
    const orchestrator = { analyze: vi.fn().mockResolvedValue({
      analysis,
      usage: { requestDurationMs: 12, retries: 0 },
      promptVersion: 'v2',
    }) };
    const service = new RcaApiService(repository, orchestrator, persistence);

    await expect(service.generate('org_1', 'project_1', 'finding_1', true)).resolves.toEqual(persisted);
    expect(orchestrator.analyze).toHaveBeenCalledOnce();
    expect(persistence.persist).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org_1',
      projectId: 'project_1',
      findingId: 'finding_1',
      provider: 'openai-compatible',
      model: 'unknown',
      promptVersion: 'v2',
      usage: expect.any(Object),
    }));
  });

  it('rejects a non-bottleneck finding for RCA generation', async () => {
    const repository = {
      findFinding: vi.fn().mockResolvedValue(finding({ type: 'latency' })),
    };
    const persistence = { findLatest: vi.fn(), list: vi.fn(), persist: vi.fn() };
    const orchestrator = { analyze: vi.fn() };
    const service = new RcaApiService(repository, orchestrator, persistence);

    await expect(service.generate('org_1', 'project_1', 'finding_1', true))
      .rejects.toThrow('Finding does not contain an RCA-supported bottleneck');
  });

  it('preserves tenant isolation on reads', async () => {
    const repository = { findFinding: vi.fn().mockResolvedValue(finding()) };
    const persistence = {
      findLatest: vi.fn().mockResolvedValue({ id: 'rca_1' }),
      list: vi.fn().mockResolvedValue([{ id: 'rca_1' }]),
      persist: vi.fn(),
    };
    const service = new RcaApiService(repository, { analyze: vi.fn() }, persistence);

    await service.getLatest('org_1', 'project_1', 'finding_1');
    await service.getHistory('org_1', 'project_1', 'finding_1');

    expect(repository.findFinding).toHaveBeenNthCalledWith(1, 'org_1', 'project_1', 'finding_1');
    expect(repository.findFinding).toHaveBeenNthCalledWith(2, 'org_1', 'project_1', 'finding_1');
    expect(persistence.findLatest).toHaveBeenCalledWith('org_1', 'project_1', 'finding_1');
    expect(persistence.list).toHaveBeenCalledWith('org_1', 'project_1', 'finding_1');
  });
});
