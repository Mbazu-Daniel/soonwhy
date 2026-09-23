import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { InvestigationService } from './investigation.service';
import type { InvestigationRepository } from './investigation.repository';

describe('InvestigationService', () => {
  const repository = {
    list: vi.fn(),
    getById: vi.fn(),
    findOpenByFinding: vi.fn(),
    getFinding: vi.fn(),
    create: vi.fn(),
  } as unknown as InvestigationRepository;

  let service: InvestigationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InvestigationService(repository);
  });

  it('rejects a finding outside the tenant', async () => {
    vi.mocked(repository.getFinding).mockResolvedValue(undefined);

    await expect(service.start('finding-2', 'org-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('prevents duplicate open investigations', async () => {
    vi.mocked(repository.getFinding).mockResolvedValue({
      id: 'finding-1',
      projectId: 'project-1',
      serviceName: 'checkout-api',
      title: 'Correlated bottleneck',
      description: 'Slow checkout dependency',
      evidence: [],
    } as never);
    vi.mocked(repository.findOpenByFinding).mockResolvedValue({ id: 'investigation-1' } as never);

    await expect(service.start('finding-1', 'org-1'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a reproducible evidence snapshot', async () => {
    vi.mocked(repository.getFinding).mockResolvedValue({
      id: 'finding-1',
      projectId: 'project-1',
      serviceName: 'checkout-api',
      type: 'bottleneck',
      severity: 'critical',
      title: 'Correlated bottleneck',
      description: 'Slow checkout dependency',
      observedValue: 1600,
      threshold: 1000,
      unit: 'ms',
      windowStart: new Date('2026-09-20T18:00:00.000Z'),
      windowEnd: new Date('2026-09-20T18:15:00.000Z'),
      detectedAt: new Date('2026-09-20T18:16:00.000Z'),
      evidence: [{
        kind: 'trace',
        label: 'correlated-trace',
        value: 'trace-1',
      }],
    } as never);
    vi.mocked(repository.findOpenByFinding).mockResolvedValue(undefined);
    vi.mocked(repository.create).mockImplementation(async (data) => data as never);

    const result = await service.start('finding-1', 'org-1');

    expect(result.evidenceSnapshot).toMatchObject({
      finding: { id: 'finding-1', type: 'bottleneck' },
      evidence: [{ label: 'correlated-trace', value: 'trace-1' }],
    });
    expect(result.projectId).toBe('project-1');
  });
});
