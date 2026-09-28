import { describe, expect, it, vi } from 'vitest';
import type { IssueLifecycle } from './issue-lifecycle.types';
import { IssueLifecycleQueryService } from './issue-lifecycle.query.service';

const lifecycle: IssueLifecycle = {
  issueKey: '1:query-fingerprint',
  identity: {
    domain: 'database',
    fingerprint: 'query-fingerprint',
    fingerprintVersion: 1,
    serviceName: 'api',
    operationName: 'GET /users',
  },
  status: 'active',
  firstObservedAt: '2026-09-28T10:00:00Z',
  lastObservedAt: '2026-09-28T10:15:00Z',
};

describe('IssueLifecycleQueryService', () => {
  it('lists lifecycles with the requested scope and status', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue([lifecycle]),
      find: vi.fn(),
    };
    const service = new IssueLifecycleQueryService(repository);

    await expect(service.list('org-1', 'project-1', 'active', 25)).resolves.toEqual([lifecycle]);
    expect(repository.list).toHaveBeenCalledWith('org-1', 'project-1', 'active', 25);
  });

  it('gets a lifecycle by its stable issue key', async () => {
    const repository = {
      list: vi.fn(),
      find: vi.fn().mockResolvedValue(lifecycle),
    };
    const service = new IssueLifecycleQueryService(repository);

    await expect(
      service.get('org-1', 'project-1', lifecycle.issueKey),
    ).resolves.toEqual(lifecycle);
    expect(repository.find).toHaveBeenCalledWith(
      'org-1',
      'project-1',
      lifecycle.issueKey,
    );
  });
});
