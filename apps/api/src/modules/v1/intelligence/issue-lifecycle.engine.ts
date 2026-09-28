import type { Issue } from './issue.types';
import type { IssueLifecycle } from './issue-lifecycle.types';

export function createIssueLifecycle(issue: Issue): IssueLifecycle {
  const firstObservation = issue.observations.reduce((earliest, observation) =>
    compareTimestamps(observation.observedAt, earliest.observedAt) < 0 ? observation : earliest,
  );
  const lastObservation = issue.observations.reduce((latest, observation) =>
    compareTimestamps(observation.observedAt, latest.observedAt) > 0 ? observation : latest,
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
  if (createIssueKey(issue.identity) !== lifecycle.issueKey) return undefined;

  const latestObservedAt = issue.lastObservedAt ?? getLatestObservation(issue);
  if (!isValidTimestamp(latestObservedAt) || !isValidTimestamp(lifecycle.lastObservedAt)) {
    return undefined;
  }

  const comparison = compareTimestamps(latestObservedAt, lifecycle.lastObservedAt);
  if (!Number.isFinite(comparison) || comparison <= 0) return undefined;

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
    compareTimestamps(resolvedAt, lifecycle.lastObservedAt) < 0
  ) {
    return undefined;
  }

  return { ...lifecycle, status: 'resolved', resolvedAt };
}

export function reopenIssue(
  lifecycle: IssueLifecycle,
  observedAt: string,
): IssueLifecycle | undefined {
  if (
    lifecycle.status !== 'resolved' ||
    !isValidTimestamp(observedAt) ||
    compareTimestamps(observedAt, lifecycle.lastObservedAt) <= 0
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
  return identity.fingerprintVersion + ':' + identity.fingerprint;
}

function getLatestObservation(issue: Issue): string {
  return issue.observations.reduce((latest, observation) =>
    compareTimestamps(observation.observedAt, latest.observedAt) > 0 ? observation : latest,
  ).observedAt;
}

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function compareTimestamps(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Number.NaN;
  return leftTime - rightTime;
}
