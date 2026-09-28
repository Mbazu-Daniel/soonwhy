import { describe, expect, it } from 'vitest';
import { buildIssue } from './issue.engine';
import type { EvidenceConfidence } from './evidence-confidence';
import type { TelemetryIdentity } from './telemetry-identity.types';

const identity: TelemetryIdentity = {
  domain: 'database',
  fingerprint: 'query-fingerprint',
  fingerprintVersion: 1,
  serviceName: 'api',
  operationName: 'GET /users',
};

const confidence: EvidenceConfidence = {
  identity,
  score: 1,
  status: 'confirmed',
  observationCount: 2,
  windowCount: 2,
  independentSourceCount: 2,
};

describe('buildIssue', () => {
  it('builds an issue from identity-scoped evidence', () => {
    const issue = buildIssue({
      identity,
      confidence,
      observations: [
        {
          name: 'query.duration',
          value: 700,
          source: 'database',
          observedAt: '2026-09-28T10:00:00Z',
        },
        {
          name: 'latency',
          value: 900,
          source: 'metric',
          observedAt: '2026-09-28T10:05:00Z',
        },
      ],
      windows: [
        { start: '2026-09-28T10:00:00Z', end: '2026-09-28T10:05:00Z' },
        { start: '2026-09-28T10:05:00Z', end: '2026-09-28T10:10:00Z' },
      ],
    });

    expect(issue).toMatchObject({
      identity,
      status: 'confirmed',
      firstObservedAt: '2026-09-28T10:00:00Z',
      lastObservedAt: '2026-09-28T10:05:00Z',
    });
    expect(issue?.windows).toHaveLength(2);
  });

  it('rejects confidence from a different identity', () => {
    const otherIdentity = { ...identity, fingerprint: 'different-query' };

    const issue = buildIssue({
      identity,
      confidence: { ...confidence, identity: otherIdentity },
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
    });

    expect(issue).toBeUndefined();
  });

  it('removes duplicate and invalid windows', () => {
    const issue = buildIssue({
      identity,
      confidence,
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
        { start: '2026-09-28T10:00:00Z', end: '2026-09-28T10:05:00Z' },
        { start: '2026-09-28T10:05:00Z', end: '2026-09-28T10:05:00Z' },
      ],
    });

    expect(issue?.windows).toHaveLength(1);
  });

  it('does not build an issue without observations or windows', () => {
    expect(
      buildIssue({
        identity,
        confidence,
        observations: [],
        windows: [{ start: '2026-09-28T10:00:00Z', end: '2026-09-28T10:05:00Z' }],
      }),
    ).toBeUndefined();
  });
});
