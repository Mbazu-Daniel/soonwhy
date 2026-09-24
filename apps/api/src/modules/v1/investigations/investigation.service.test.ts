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
      evidence: [],
    } as never);
    vi.mocked(repository.create).mockRejectedValue({ code: '23505' });

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

  it('builds a deterministic graph from the investigation snapshot', async () => {
    vi.mocked(repository.getById).mockResolvedValue({
      id: 'investigation-1',
      findingId: 'finding-1',
      serviceName: 'checkout-api',
      title: 'Investigation for checkout latency',
      evidenceSnapshot: {
        finding: { id: 'finding-1', severity: 'high' },
        evidence: [
          { kind: 'metric', label: 'p95-latency', value: 1600 },
          { kind: 'trace', label: 'slow-trace', value: 'trace-1' },
          { kind: 'trace', label: 'slow-trace', value: 'trace-1' },
        ],
      },
    } as never);

    const graph = await service.getGraph('investigation-1', 'org-1');

    expect(graph.investigationId).toBe('investigation-1');
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges.every((edge) => edge.type === 'supported_by')).toBe(true);
    expect(graph.nodes[1]).toMatchObject({
      id: 'evidence:finding-1:%5B%22metric%22%2C%22p95-latency%22%2C1600%2Cnull%5D',
      type: 'evidence',
      label: 'p95-latency',
    });
  });

  it('produces the same graph regardless of evidence order', async () => {
    const base = {
      id: 'investigation-1',
      findingId: 'finding-1',
      serviceName: 'checkout-api',
      title: 'Investigation for checkout latency',
    };

    vi.mocked(repository.getById).mockResolvedValueOnce({
      ...base,
      evidenceSnapshot: {
        finding: { id: 'finding-1', severity: 'high' },
        evidence: [
          { kind: 'trace', label: 'slow-trace', value: 'trace-1' },
          { kind: 'metric', label: 'p95-latency', value: 1600 },
        ],
      },
    } as never);
    const first = await service.getGraph('investigation-1', 'org-1');

    vi.mocked(repository.getById).mockResolvedValueOnce({
      ...base,
      evidenceSnapshot: {
        finding: { id: 'finding-1', severity: 'high' },
        evidence: [
          { kind: 'metric', label: 'p95-latency', value: 1600 },
          { kind: 'trace', label: 'slow-trace', value: 'trace-1' },
        ],
      },
    } as never);
    const second = await service.getGraph('investigation-1', 'org-1');

    expect(second).toEqual(first);
  });

  it('keeps graph lookup tenant-scoped', async () => {
    vi.mocked(repository.getById).mockResolvedValue(undefined);

    await expect(service.getGraph('investigation-2', 'org-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
