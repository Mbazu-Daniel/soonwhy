import { describe, expect, it } from 'vitest';
import { applyIssueLifecycle } from './issue-lifecycle.coordinator';
import { createIssueLifecycle, resolveIssue } from './issue-lifecycle.engine';
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

describe('applyIssueLifecycle', () => {
  it('creates a lifecycle for a new issue', () => {
    const result = applyIssueLifecycle(issue);

    expect(result.action).toBe('created');
    expect(result.lifecycle?.status).toBe('active');
  });

  it('updates an active lifecycle with newer evidence', () => {
    const lifecycle = createIssueLifecycle(issue);
    const result = applyIssueLifecycle({
      ...issue,
      lastObservedAt: '2026-09-28T10:15:00Z',
    }, lifecycle);

    expect(result.action).toBe('updated');
    expect(result.lifecycle?.lastObservedAt).toBe('2026-09-28T10:15:00Z');
  });

  it('reopens a resolved lifecycle only with newer evidence', () => {
    const lifecycle = resolveIssue(
      createIssueLifecycle(issue),
      '2026-09-28T10:10:00Z',
    );

    expect(lifecycle).toBeDefined();

    const result = applyIssueLifecycle({
      ...issue,
      lastObservedAt: '2026-09-28T10:15:00Z',
    }, lifecycle);

    expect(result.action).toBe('reopened');
    expect(result.lifecycle?.status).toBe('active');
  });

  it('ignores stale evidence', () => {
    const lifecycle = createIssueLifecycle(issue);

    const result = applyIssueLifecycle({
      ...issue,
      lastObservedAt: '2026-09-28T09:59:00Z',
    }, lifecycle);

    expect(result).toEqual({ action: 'ignored' });
  });
});
