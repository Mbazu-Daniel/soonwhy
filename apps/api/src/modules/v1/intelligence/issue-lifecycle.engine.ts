import type { Issue } from './issue.types';
import type { IssueLifecycle } from './issue-lifecycle.types';

export function createIssueLifecycle(issue: Issue): IssueLifecycle {
  return {
    issueKey: createIssueKey(issue.identity),
    identity: issue.identity,
    status: 'active',
    firstObservedAt: issue.firstObservedAt ?? issue.observations[0].observedAt,
    lastObservedAt: issue.lastObservedAt ?? issue.observations[0].observedAt,
  };
}

export function resolveIssue(
  lifecycle: IssueLifecycle,
  resolvedAt: string,
): IssueLifecycle | undefined {
  if (resolvedAt < lifecycle.lastObservedAt) {
    return undefined;
  }

  return {
    ...lifecycle,
    status: 'resolved',
    resolvedAt,
  };
}

export function reopenIssue(
  lifecycle: IssueLifecycle,
  observedAt: string,
): IssueLifecycle | undefined {
  if (lifecycle.status !== 'resolved' || observedAt < lifecycle.lastObservedAt) {
    return undefined;
  }

  return {
    ...lifecycle,
    status: 'active',
    lastObservedAt: observedAt,
    resolvedAt: undefined,
  };
}

export function createIssueKey(identity: Issue['identity']): string {
  return `${identity.fingerprintVersion}:${identity.fingerprint}`;
}
