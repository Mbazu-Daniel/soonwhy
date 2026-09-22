import { describe, expect, it, vi } from 'vitest';
import type { RcaAnalysis, RcaEvidence } from './rca.types';
import { RcaPersistenceService } from './rca.persistence';

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

describe('RcaPersistenceService', () => {
  it('persists a grounded analysis with its evidence snapshot and metadata', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({ id: 'rca_123' }),
      findLatest: vi.fn(),
      list: vi.fn(),
    };
    const service = new RcaPersistenceService(repository);

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

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org_123',
        projectId: 'project_123',
        findingId: 'finding_latency',
        evidenceSnapshot: evidence,
        provider: 'openai-compatible',
        model: 'test-model',
        promptVersion: 'v1',
      }),
    );
  });

  it('keeps regeneration as a new analysis record', async () => {
    const repository = {
      create: vi.fn()
        .mockResolvedValueOnce({ id: 'rca_1' })
        .mockResolvedValueOnce({ id: 'rca_2' }),
      findLatest: vi.fn(),
      list: vi.fn(),
    };
    const service = new RcaPersistenceService(repository);

    await service.persist({
      orgId: 'org_123',
      projectId: 'project_123',
      findingId: 'finding_latency',
      evidence,
      analysis,
      provider: 'openai-compatible',
      model: 'test-model',
      promptVersion: 'v1',
    });
    await service.persist({
      orgId: 'org_123',
      projectId: 'project_123',
      findingId: 'finding_latency',
      evidence,
      analysis,
      provider: 'openai-compatible',
      model: 'test-model',
      promptVersion: 'v1',
    });

    expect(repository.create).toHaveBeenCalledTimes(2);
  });

  it('passes tenant and project scope through to reads', async () => {
    const repository = {
      create: vi.fn(),
      findLatest: vi.fn().mockResolvedValue({ id: 'rca_2' }),
      list: vi.fn().mockResolvedValue([]),
    };
    const service = new RcaPersistenceService(repository);

    await service.findLatest('org_123', 'project_123', 'finding_latency');
    await service.list('org_123', 'project_123', 'finding_latency');

    expect(repository.findLatest).toHaveBeenCalledWith(
      'org_123',
      'project_123',
      'finding_latency',
    );
    expect(repository.list).toHaveBeenCalledWith(
      'org_123',
      'project_123',
      'finding_latency',
    );
  });
});
