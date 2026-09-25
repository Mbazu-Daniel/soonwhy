import { describe, expect, it, vi } from 'vitest';
import type { RcaAnalysis, RcaEvidence } from './rca.types';
import { RcaPersistenceService } from './rca.persistence';
import type { RcaAnalysisRepository } from './rca.repository';

const evidence: RcaEvidence = {
  projectId: 'project_123',
  serviceName: 'checkout-api',
  severity: 'critical',
  window: {
    start: new Date('2026-09-22T10:00:00.000Z'),
    end: new Date('2026-09-22T10:15:00.000Z'),
  },
  primaryFinding: {
    id: 'finding_latency',
    sourceFindingId: 'finding_latency',
    type: 'latency',
    severity: 'critical',
    label: 'latency',
    value: 1600,
  },
  supportingFindings: [],
  traces: [],
  recommendations: [],
};

const analysis: RcaAnalysis = {
  summary: 'Checkout latency increased.',
  rootCause: 'The evidence points to a slow database dependency.',
  contributingFactors: ['Database latency increased.'],
  investigationSteps: ['Inspect the database query plan.'],
  suggestedChanges: ['Review the query and index usage.'],
  evidenceRefs: ['finding_latency'],
  confidence: 'high',
  limitations: [],
};

function repository(): Pick<RcaAnalysisRepository, 'create' | 'findLatest' | 'list'> {
  return {
    create: vi.fn(),
    findLatest: vi.fn(),
    list: vi.fn(),
  };
}

describe('RcaPersistenceService', () => {
  it('persists a grounded analysis with its evidence snapshot and metadata', async () => {
    const repo = repository();
    vi.mocked(repo.create).mockResolvedValue({ id: 'rca_123' } as never);
    const service = new RcaPersistenceService(repo);

    await expect(
      service.persist({
        orgId: 'org_123',
        projectId: 'project_123',
        findingId: 'finding_latency',
        evidence,
        analysis,
        provider: 'openai-compatible',
        model: 'test-model',
        promptVersion: 'v1',
      }),
    ).resolves.toEqual({ id: 'rca_123' });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org_123',
        projectId: 'project_123',
        findingId: 'finding_latency',
        evidenceSnapshot: expect.objectContaining({ projectId: 'project_123' }),
        provider: 'openai-compatible',
        model: 'test-model',
        promptVersion: 'v1',
      }),
    );
  });

  it('keeps regeneration as a new analysis record', async () => {
    const repo = repository();
    vi.mocked(repo.create)
      .mockResolvedValueOnce({ id: 'rca_1' } as never)
      .mockResolvedValueOnce({ id: 'rca_2' } as never);
    const service = new RcaPersistenceService(repo);

    const input = {
      orgId: 'org_123',
      projectId: 'project_123',
      findingId: 'finding_latency',
      evidence,
      analysis,
      provider: 'openai-compatible',
      model: 'test-model',
      promptVersion: 'v1',
    };
    await service.persist(input);
    await service.persist(input);

    expect(repo.create).toHaveBeenCalledTimes(2);
  });

  it('passes tenant and project scope through to reads', async () => {
    const repo = repository();
    vi.mocked(repo.findLatest).mockResolvedValue({ id: 'rca_2' } as never);
    vi.mocked(repo.list).mockResolvedValue([]);
    const service = new RcaPersistenceService(repo);

    await service.findLatest('org_123', 'project_123', 'finding_latency');
    await service.list('org_123', 'project_123', 'finding_latency');

    expect(repo.findLatest).toHaveBeenCalledWith(
      'org_123',
      'project_123',
      'finding_latency',
    );
    expect(repo.list).toHaveBeenCalledWith(
      'org_123',
      'project_123',
      'finding_latency',
    );
  });
});
