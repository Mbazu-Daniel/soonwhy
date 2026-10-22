import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../common/db';
import type { QuickwitService } from '@soonwhy/shared';
import type { ProjectsRepository } from '../projects/projects.repository';
import { DetectionService } from './detection.service';

vi.mock('../../../common/db', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

describe('DetectionService unified dependency intelligence', () => {
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
          severity: 'warning',
          title: input.type,
          description: input.type,
          observedValue: 800,
          threshold: 100,
          unit: 'ms',
          windowStart: new Date('2026-09-20T18:00:00.000Z'),
          windowEnd: new Date('2026-09-20T18:15:00.000Z'),
          evidence: input.evidence ?? [],
        }]),
      })),
    } as never));

    vi.mocked(db.update).mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'run-1', status: 'completed' }]),
        }),
      }),
    } as never));
  });

  it('routes dependency latency and error regression through the shared evaluator', async () => {
    search
      .mockResolvedValueOnce({ aggregations: { services: { buckets: [] } } })
      .mockResolvedValueOnce({ aggregations: { services: { buckets: [] } } })
      .mockResolvedValueOnce({
        aggregations: {
          dependencies: {
            buckets: [{
              key: 'checkout-api',
              dependencies: {
                buckets: [{
                  key: 'postgres',
                  doc_count: 20,
                  latency: { values: { '95.0': 800 } },
                  errors: { doc_count: 6 },
                  dependencyType: { buckets: [{ key: 'database', doc_count: 20 }] },
                }],
              },
            }],
          },
        },
      })
      .mockResolvedValueOnce({
        aggregations: {
          dependencies: {
            buckets: [{
              key: 'checkout-api',
              dependencies: {
                buckets: [{
                  key: 'postgres',
                  doc_count: 20,
                  latency: { values: { '95.0': 200 } },
                  errors: { doc_count: 0 },
                  dependencyType: { buckets: [{ key: 'database', doc_count: 20 }] },
                }],
              },
            }],
          },
        },
      });

    const quickwit = { search } as unknown as QuickwitService;
    const projectsRepository = { getProjectById } as unknown as ProjectsRepository;
    const issueLifecycleService = { apply: vi.fn().mockResolvedValue({ action: 'created' }) } as never;
    const service = new DetectionService(quickwit, projectsRepository, issueLifecycleService);

    const result = await service.run('org-1', 'project-1');

    const finding = result.find((item) => item.type === 'dependency_latency');
    expect(finding).toMatchObject({
      serviceName: 'checkout-api',
      severity: 'critical',
      observedValue: 800,
    });
    expect(finding?.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'dependency-profile' }),
      expect.objectContaining({ label: 'optimization-guidance' }),
    ]));
    expect(finding?.evidence.find((item) => item.label === 'dependency-profile')?.context).toMatchObject({
      dependencyType: 'database',
      dependencyName: 'postgres',
      sampleCount: 20,
      errorCount: 6,
      errorRate: 0.3,
      signals: 'latency,latency_regression,errors,error_regression',
      confidence: 'high',
    });
  });
});
