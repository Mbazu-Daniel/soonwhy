import { describe, expect, it } from 'vitest';
import type { IssueCandidate } from './evidence.types';

describe('evidence model', () => {
  it('keeps identity separate from observations', () => {
    const candidate = {
      identity: {
        domain: 'database',
        fingerprint: 'abc',
        fingerprintVersion: 1,
        serviceName: 'checkout',
      },
      evidence: {
        identity: {
          domain: 'database',
          fingerprint: 'abc',
          fingerprintVersion: 1,
          serviceName: 'checkout',
        },
        observations: [
          {
            name: 'latency.p95',
            value: 1200,
            unit: 'ms',
            source: 'database',
            observedAt: '2026-09-28T00:00:00.000Z',
          },
        ],
        window: {
          start: '2026-09-28T00:00:00.000Z',
          end: '2026-09-28T00:15:00.000Z',
        },
      },
      status: 'candidate',
    } satisfies IssueCandidate;

    expect(candidate.identity.fingerprint).toBe('abc');
    expect(candidate.evidence.observations[0]?.name).toBe('latency.p95');
  });
});
