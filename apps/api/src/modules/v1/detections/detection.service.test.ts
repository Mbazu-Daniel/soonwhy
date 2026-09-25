import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../common/db';
import type { QuickwitService } from '@soonwhy/shared';
import type { ProjectsRepository } from '../projects/projects.repository';
import { DetectionService } from './detection.service';

vi.mock('../../../common/db', () => ({
  db: {
    insert: vi.fn(),
  },
}));

describe('DetectionService', () => {
  const search = vi.fn();
  const quickwit = { search } as unknown as QuickwitService;
  const getProjectById = vi.fn();
  const projectsRepository = { getProjectById } as unknown as ProjectsRepository;

  const persistedRow = {
    id: 'finding-1',
    projectId: 'project-1',
    serviceName: 'orders/service',
    type: 'latency',
    severity: 'warning',
    title: 'High latency detected in orders/service',
    description: 'The 95th percentile request latency is 1500ms over the last 15 minutes.',
    observedValue: 1500,
    threshold: 1000,
    unit: 'ms',
    windowStart: new Date('2026-09-19T22:00:00.000Z'),
    windowEnd: new Date('2026-09-19T22:15:00.000Z'),
    evidence: [
      {
        kind: 'request',
        label: 'slow-request',
        value: 1500,
        context: {
          service: 'orders/service',
          method: 'GET',
          path: '/orders',
          statusCode: 200,
          traceId: 'trace-1',
          timestamp: '2026-09-19T22:10:00.000Z',
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getProjectById.mockResolvedValue({ id: 'project-1', orgId: 'org-1' });

    const returning = vi.fn().mockResolvedValue([persistedRow]);
    const values = vi.fn().mockReturnValue({ returning });
    vi.mocked(db.insert).mockReturnValue({ values } as never);
  });

  it('detects high latency and persists sanitized evidence for the scoped project', async () => {
    search
      .mockResolvedValueOnce({
        aggregations: {
          services: {
            buckets: [
              {
                key: 'orders/service',
                doc_count: 10,
                latency: { values: { '95.0': 1500 } },
                errors: { doc_count: 0 },
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        hits: [
          {
            _source: {
              service: 'orders/service',
              method: 'GET',
              url: 'https://api.example.com/orders?api_key=secret',
              duration: 1500,
              statusCode: 200,
              traceId: 'trace-1',
              timestamp: '2026-09-19T22:10:00.000Z',
            },
          },
        ],
      });

    const service = new DetectionService(quickwit, projectsRepository);
    const findings = await service.run('org-1', 'project-1');

    expect(projectsRepository.getProjectById).toHaveBeenCalledWith('project-1', 'org-1');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.type).toBe('latency');
    expect(findings[0]?.evidence[0]?.context?.path).toBe('/orders');

    const evidenceQuery = search.mock.calls[1]?.[1]?.query as string;
    expect(evidenceQuery).toContain('service:"orders\\/service"');

    const inserted = vi.mocked(db.insert).mock.results[0]?.value as {
      values: ReturnType<typeof vi.fn>;
    };
    const insertedValues = inserted.values.mock.calls[0]?.[0] as {
      orgId: string;
      projectId: string;
      evidence: unknown[];
    };
    expect(insertedValues.orgId).toBe('org-1');
    expect(insertedValues.projectId).toBe('project-1');
    expect(insertedValues.evidence[0]).toMatchObject({
      context: { path: '/orders' },
    });
  });

  it('detects a critical error-rate finding when 5xx responses reach 10 percent', async () => {
    search
      .mockResolvedValueOnce({
        aggregations: {
          services: {
            buckets: [
              {
                key: 'payments',
                doc_count: 10,
                latency: { values: { '95.0': 200 } },
                errors: { doc_count: 1 },
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        hits: [
          {
            _source: {
              service: 'payments',
              method: 'POST',
              url: '/payments?token=secret',
              statusCode: 500,
              traceId: 'trace-2',
              timestamp: '2026-09-19T22:10:00.000Z',
            },
          },
        ],
      });

    const errorPersistedRow = {
      ...persistedRow,
      type: 'error_rate',
      severity: 'critical',
      title: 'Elevated error rate in payments',
      description: 'HTTP 5xx responses account for 10.00% of requests over the last 15 minutes.',
      observedValue: 10,
      threshold: 5,
      unit: '%',
      evidence: [
        {
          kind: 'request',
          label: 'error-request',
          value: 500,
          context: {
            service: 'payments',
            method: 'POST',
            path: '/payments',
            statusCode: 500,
            traceId: 'trace-2',
            timestamp: '2026-09-19T22:10:00.000Z',
          },
        },
      ],
    };
    const returning = vi.fn().mockResolvedValue([errorPersistedRow]);
    const values = vi.fn().mockReturnValue({ returning });
    vi.mocked(db.insert).mockReturnValue({ values } as never);

    const service = new DetectionService(quickwit, projectsRepository);
    const findings = await service.run('org-1', 'project-1');

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      type: 'error_rate',
      severity: 'critical',
      observedValue: 10,
      threshold: 5,
      unit: '%',
    });
    expect(findings[0]?.evidence[0]?.value).toBe(500);
    expect(findings[0]?.evidence[0]?.context?.path).toBe('/payments');
  });

  it('rejects a project outside the active organization before querying telemetry', async () => {
    getProjectById.mockResolvedValue(undefined);

    const service = new DetectionService(quickwit, projectsRepository);

    await expect(service.run('org-1', 'project-from-another-org')).rejects.toThrow('Project not found');
    expect(search).not.toHaveBeenCalled();
  });
  it('escapes service names before building Quickwit evidence queries', async () => {
    search
      .mockResolvedValueOnce({
        aggregations: {
          services: {
            buckets: [
              {
                key: 'orders" OR statusCode:500',
                doc_count: 1,
                latency: { values: { '95.0': 1500 } },
                errors: { doc_count: 0 },
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({ hits: [] });

    const service = new DetectionService(quickwit, projectsRepository);
    await service.run('org-1', 'project-1');

    const evidenceQuery = search.mock.calls[1]?.[1]?.query as string;
    expect(evidenceQuery).toContain('service:"orders\\" OR statusCode\\:500"');
  });

  it('rejects listing findings for a project outside the active organization', async () => {
    getProjectById.mockResolvedValue(undefined);

    const service = new DetectionService(quickwit, projectsRepository);

    await expect(service.list('org-1', 'project-from-another-org')).rejects.toThrow('Project not found');
  });

});
