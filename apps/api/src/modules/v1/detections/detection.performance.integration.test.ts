import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../common/db';
import type { QuickwitService } from '@soonwhy/shared';
import type { ProjectsRepository } from '../projects/projects.repository';
import { DetectionService } from './detection.service';

vi.mock('../../../common/db', () => ({ db: { insert: vi.fn(), update: vi.fn() } }));

describe('DetectionService performance integration', () => {
  const search = vi.fn();
  const getProjectById = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getProjectById.mockResolvedValue({ id: 'project-1', orgId: 'org-1' });
    search.mockResolvedValue({ hits: [] });
    let sequence = 0;
    vi.mocked(db.insert).mockImplementation(() => ({
      values: vi.fn().mockImplementation((input: { type: string; evidence?: unknown[] }) => ({
        returning: vi.fn().mockResolvedValue([{
          id: 'finding-' + (++sequence),
          projectId: 'project-1',
          serviceName: 'checkout-api',
          type: input.type,
          severity: 'critical',
          title: input.type,
          description: input.type,
          observedValue: 1600,
          threshold: 100,
          unit: 'ms',
          windowStart: new Date(),
          windowEnd: new Date(),
          evidence: input.evidence ?? [],
        }]),
      })),
    } as never));
    vi.mocked(db.update).mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'run-1', status: 'completed' }]) }),
      }),
    } as never));
  });

  it('persists endpoint performance with trace evidence', async () => {
    search
      .mockResolvedValueOnce({ aggregations: { services: { buckets: [] } } })
      .mockResolvedValueOnce({ aggregations: { services: { buckets: [] } } })
      .mockResolvedValueOnce({ aggregations: { services: { buckets: [{
        key: 'checkout-api',
        endpoints: { buckets: [{
          key: '/checkout',
          methods: { buckets: [{ key: 'POST', doc_count: 50, latency: { values: { '95.0': 1600 } }, errors: { doc_count: 10 } }] },
        }] },
      }] } } })
      .mockResolvedValueOnce({ aggregations: { services: { buckets: [{
        key: 'checkout-api',
        endpoints: { buckets: [{
          key: '/checkout',
          methods: { buckets: [{ key: 'POST', doc_count: 100, latency: { values: { '95.0': 700 } }, errors: { doc_count: 2 } }] },
        }] },
      }] } } })
      .mockResolvedValueOnce({ hits: [{ _source: {
        service: 'checkout-api',
        method: 'POST',
        url: '/checkout',
        traceId: 'trace-checkout-001',
        timestamp: '2026-09-20T18:10:00.000Z',
      } }] });

    const service = new DetectionService(
      { search } as unknown as QuickwitService,
      { getProjectById } as unknown as ProjectsRepository,
      { apply: vi.fn().mockResolvedValue({ action: 'created' }) } as never,
    );

    const result = await service.run('org-1', 'project-1');
    const finding = result.find((item) => item.type === 'latency');

    expect(finding).toMatchObject({ serviceName: 'checkout-api', severity: 'critical' });
    expect(finding?.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'performance-endpoint' }),
      expect.objectContaining({ label: 'endpoint-trace', value: 'trace-checkout-001' }),
    ]));
  });
});
