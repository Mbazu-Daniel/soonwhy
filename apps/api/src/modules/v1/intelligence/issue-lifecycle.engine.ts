import type { Issue } from './issue.types';
import type { IssueLifecycle } from './issue-lifecycle.types';

export function createIssueLifecycle(issue: Issue): IssueLifecycle {
  const firstObservation = issue.observations.reduce((earliest, observation) =>
    observation.observedAt < earliest.observedAt ? observation : earliest,
  );

  const lastObservation = issue.observations.reduce((latest, observation) =>
    observation.observedAt > latest.observedAt ? observation : latest,
  );

  return {
    issueKey: createIssueKey(issue.identity),
    identity: issue.identity,
    status: 'active',
    firstObservedAt: issue.firstObservedAt ?? firstObservation.observedAt,
    lastObservedAt: issue.lastObservedAt ?? lastObservation.observedAt,
  };
}

export function updateIssueLifecycle(
  lifecycle: IssueLifecycle,
  issue: Issue,
): IssueLifecycle | undefined {
  if (createIssueKey(issue.identity) !== lifecycle.issueKey) {
    return undefined;
  }

  const latestObservedAt = issue.lastObservedAt ?? issue.observations.reduce(
    (latest, observation) =>
      observation.observedAt > latest.observedAt ? observation : latest,
  ).observedAt;

  if (latestObservedAt < lifecycle.lastObservedAt) {
    return undefined;
  }

  return {
    ...lifecycle,
    status: 'active',
    lastObservedAt: latestObservedAt,
    resolvedAt: undefined,
  };
}

export function resolveIssue(
  lifecycle: IssueLifecycle,
  resolvedAt: string,
): IssueLifecycle | undefined {
  if (
    lifecycle.status !== 'active' ||
    !isValidTimestamp(resolvedAt) ||
    resolvedAt < lifecycle.lastObservedAt
  ) {
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
  if (
    lifecycle.status !== 'resolved' ||
    !isValidTimestamp(observedAt) ||
    observedAt < lifecycle.lastObservedAt
  ) {
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

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
