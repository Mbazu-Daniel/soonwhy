import { describe, expect, it, vi } from 'vitest';
import { createIssueLifecycle, resolveIssue } from './issue-lifecycle.engine';
import type { Issue } from './issue.types';
import { IssueLifecycleService } from './issue-lifecycle.service';
import type { IssueLifecycleRepository } from './issue-lifecycle.repository';
import type { IssueLifecycle } from './issue-lifecycle.types';
import type { TelemetryIdentity } from './telemetry-identity.types';

const identity: TelemetryIdentity = { domain: 'database', fingerprint: 'query-fingerprint', fingerprintVersion: 1, serviceName: 'api', operationName: 'GET /users' };
const issue: Issue = { identity, confidence: { identity, score: 0.9, status: 'confirmed', observationCount: 5, windowCount: 3, independentSourceCount: 2 }, status: 'confirmed', observations: [{ name: 'query.duration', value: 700, source: 'database', observedAt: '2026-09-28T10:00:00Z' }], windows: [{ start: '2026-09-28T10:00:00Z', end: '2026-09-28T10:05:00Z' }], firstObservedAt: '2026-09-28T10:00:00Z', lastObservedAt: '2026-09-28T10:00:00Z' };

function createRepository() {
  const lifecycles = new Map<string, IssueLifecycle>();
  const repository = {
    find: vi.fn(async (_orgId: string, _projectId: string, issueKey: string) => lifecycles.get(issueKey)),
    save: vi.fn(async (input: { orgId: string; projectId: string; lifecycle: IssueLifecycle }) => { lifecycles.set(input.lifecycle.issueKey, input.lifecycle); return input.lifecycle; }),
  } satisfies Pick<IssueLifecycleRepository, 'find' | 'save'>;
  return { repository, lifecycles };
}

describe('IssueLifecycleService', () => {
  it('creates and persists a new lifecycle', async () => {
    const { repository } = createRepository();
    const result = await new IssueLifecycleService(repository).apply({ orgId: 'org_1', projectId: 'project_1', issue });
    expect(result.action).toBe('created');
    expect(result.lifecycle?.status).toBe('active');
    expect(repository.find).toHaveBeenCalledWith('org_1', 'project_1', '1:query-fingerprint');
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('updates an existing lifecycle', async () => {
    const { repository, lifecycles } = createRepository();
    lifecycles.set('1:query-fingerprint', createIssueLifecycle(issue));
    const result = await new IssueLifecycleService(repository).apply({ orgId: 'org_1', projectId: 'project_1', issue: { ...issue, lastObservedAt: '2026-09-28T10:15:00Z' } });
    expect(result.action).toBe('updated');
    expect(result.lifecycle?.lastObservedAt).toBe('2026-09-28T10:15:00Z');
  });

  it('reopens a persisted resolved lifecycle', async () => {
    const { repository, lifecycles } = createRepository();
    const resolved = resolveIssue(createIssueLifecycle(issue), '2026-09-28T10:10:00Z');
    expect(resolved).toBeDefined();
    lifecycles.set('1:query-fingerprint', resolved!);
    const result = await new IssueLifecycleService(repository).apply({ orgId: 'org_1', projectId: 'project_1', issue: { ...issue, lastObservedAt: '2026-09-28T10:15:00Z' } });
    expect(result.action).toBe('reopened');
    expect(result.lifecycle?.status).toBe('active');
  });

  it('does not persist ignored evidence', async () => {
    const { repository, lifecycles } = createRepository();
    lifecycles.set('1:query-fingerprint', createIssueLifecycle(issue));
    const result = await new IssueLifecycleService(repository).apply({ orgId: 'org_1', projectId: 'project_1', issue: { ...issue, lastObservedAt: '2026-09-28T09:59:00Z' } });
    expect(result.action).toBe('ignored');
    expect(repository.save).not.toHaveBeenCalled();
  });
});
