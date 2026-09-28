import { describe, expect, it } from 'vitest';
import { createIssueKey, createIssueLifecycle, reopenIssue, resolveIssue } from './issue-lifecycle.engine';
import type { Issue } from './issue.types';
import type { TelemetryIdentity } from './telemetry-identity.types';

const identity: TelemetryIdentity = {
  domain: 'database',
  fingerprint: 'query-fingerprint',
  fingerprintVersion: 1,
  serviceName: 'api',
  operationName: 'GET /users',
};

const issue: Issue = {
  identity,
  confidence: {
    identity,
    score: 0.9,
    status: 'confirmed',
    observationCount: 5,
    windowCount: 3,
    independentSourceCount: 2,
  },
  status: 'confirmed',
  observations: [
    {
      name: 'query.duration',
      value: 700,
      source: 'database',
      observedAt: '2026-09-28T10:00:00Z',
    },
  ],
  windows: [
    { start: '2026-09-28T10:00:00Z', end: '2026-09-28T10:05:00Z' },
  ],
  firstObservedAt: '2026-09-28T10:00:00Z',
  lastObservedAt: '2026-09-28T10:00:00Z',
};

describe('issue lifecycle', () => {
  it('creates a stable key from telemetry identity', () => {
    expect(createIssueKey(identity)).toBe('1:query-fingerprint');
  });

  it('starts an issue as active', () => {
    expect(createIssueLifecycle(issue)).toMatchObject({
      issueKey: '1:query-fingerprint',
      identity,
      status: 'active',
      firstObservedAt: '2026-09-28T10:00:00Z',
      lastObservedAt: '2026-09-28T10:00:00Z',
    });
  });

  it('resolves an issue only at or after its last observation', () => {
    const lifecycle = createIssueLifecycle(issue);

    expect(resolveIssue(lifecycle, '2026-09-28T09:59:00Z')).toBeUndefined();
    expect(resolveIssue(lifecycle, '2026-09-28T10:10:00Z')).toMatchObject({
      status: 'resolved',
      resolvedAt: '2026-09-28T10:10:00Z',
    });
  });

  it('reopens a resolved issue when new evidence arrives', () => {
    const lifecycle = resolveIssue(
      createIssueLifecycle(issue),
      '2026-09-28T10:10:00Z',
    );

    expect(
      lifecycle && reopenIssue(lifecycle, '2026-09-28T10:15:00Z'),
    ).toMatchObject({
      status: 'active',
      lastObservedAt: '2026-09-28T10:15:00Z',
      resolvedAt: undefined,
    });
  });

  it('does not reopen an active issue or accept stale evidence', () => {
    const lifecycle = createIssueLifecycle(issue);

    expect(reopenIssue(lifecycle, '2026-09-28T10:15:00Z')).toBeUndefined();

    const resolved = resolveIssue(lifecycle, '2026-09-28T10:10:00Z');
    expect(resolved && reopenIssue(resolved, '2026-09-28T10:05:00Z')).toBeUndefined();
  });
});
