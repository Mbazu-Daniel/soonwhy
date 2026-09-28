import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../common/db';
import type { DetectionEvidence } from '../../../common/db/schema/findings';
import type { QuickwitService } from '@soonwhy/shared';
import type { ProjectsRepository } from '../projects/projects.repository';
import { DetectionService } from './detection.service';
import { checkoutRegressionFixture } from './detection.fixtures';

vi.mock('../../../common/db', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

describe('DetectionService realistic telemetry scenarios', () => {
  const search = vi.fn();
  const quickwit = { search } as unknown as QuickwitService;
  const getProjectById = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getProjectById.mockResolvedValue({ id: 'project-1', orgId: 'org-1' });

    let sequence = 0;
    vi.mocked(db.insert).mockImplementation(() => ({
      values: vi.fn().mockImplementation((input: { type: string; evidence?: DetectionEvidence[] }) => ({
        returning: vi.fn().mockResolvedValue([{
          id: 'finding-' + (++sequence),
          projectId: 'project-1',
          serviceName: 'checkout-api',
          type: input.type,
          severity: input.type === 'bottleneck' ? 'critical' : 'warning',
          title: input.type,
          description: input.type,
          observedValue: 1_600,
          threshold: 1_000,
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
          returning: vi.fn().mockResolvedValue([{
            id: 'run-1',
            status: 'completed',
          }]),
        }),
      }),
    } as never));
  });

  it('correlates a realistic slow-checkout scenario into one bottleneck', async () => {
    const projectsRepository = { getProjectById } as unknown as ProjectsRepository;
    search
      .mockResolvedValueOnce({ aggregations: { services: { buckets: [checkoutRegressionFixture.service.current] } } })
      .mockResolvedValueOnce({ aggregations: { services: { buckets: [checkoutRegressionFixture.service.baseline] } } })
      .mockResolvedValueOnce({ hits: [] })
      .mockResolvedValueOnce({ hits: [] })
      .mockResolvedValueOnce({ aggregations: { dependencies: { buckets: [{ key: 'checkout-api', dependencies: { buckets: [checkoutRegressionFixture.dependency.current.dependency] } }] } } })
      .mockResolvedValueOnce({ aggregations: { dependencies: { buckets: [{ key: 'checkout-api', dependencies: { buckets: [checkoutRegressionFixture.dependency.baseline.dependency] } }] } } })
      .mockResolvedValueOnce({ hits: [] })
      .mockResolvedValueOnce({ hits: [] })
      .mockResolvedValueOnce({ hits: [] })
      .mockResolvedValueOnce(checkoutRegressionFixture.trace)
      .mockResolvedValueOnce({ hits: checkoutRegressionFixture.dependencyEvidence });

    const issueLifecycleService = { apply: vi.fn().mockResolvedValue({ action: 'created' }) } as never;
    const service = new DetectionService(quickwit, projectsRepository, issueLifecycleService);
    const result = await service.run('org-1', 'project-1');

    expect(result.map((finding) => finding.type)).toEqual([
      'performance',
      'throughput',
    ]);
    const bottleneck = result.find((finding) => finding.type === 'bottleneck');
    expect(bottleneck).toMatchObject({
      type: 'bottleneck',
      serviceName: 'checkout-api',
      severity: 'critical',
    });
    expect(bottleneck?.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'correlated-trace', value: 'trace-checkout-001' }),
      expect.objectContaining({ label: 'optimization-guidance', kind: 'recommendation' }),
    ]));
  });
});
