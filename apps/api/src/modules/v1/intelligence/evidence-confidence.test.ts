import { describe, expect, it } from 'vitest';
import type { TelemetryIdentity } from './telemetry-identity.types';
import { evaluateEvidenceConfidence } from './evidence-confidence';

const identity: TelemetryIdentity = {
  domain: 'database',
  fingerprint: 'query-fingerprint',
  fingerprintVersion: 1,
  serviceName: 'api',
  operationName: 'GET /users',
};

const observations = [
  { name: 'latency', value: 900, source: 'metric' as const, observedAt: '1' },
  { name: 'query.duration', value: 700, source: 'database' as const, observedAt: '2' },
  { name: 'span.duration', value: 800, source: 'trace' as const, observedAt: '3' },
  { name: 'latency', value: 950, source: 'metric' as const, observedAt: '4' },
  { name: 'query.duration', value: 720, source: 'database' as const, observedAt: '5' },
];

describe('evidence confidence', () => {
  it('keeps sparse single-window evidence as a candidate', () => {
    const result = evaluateEvidenceConfidence({
      identity,
      observations: observations.slice(0, 1),
      windows: [{ start: '1', end: '2' }],
    });

    expect(result.status).toBe('candidate');
    expect(result.identity).toEqual(identity);
  });

  it('requires repeated windows and multiple sources for confirmation', () => {
    const result = evaluateEvidenceConfidence({
      identity,
      observations,
      windows: [
        { start: '1', end: '2' },
        { start: '2', end: '3' },
        { start: '3', end: '4' },
      ],
    });

    expect(result.status).toBe('confirmed');
    expect(result.score).toBe(1);
    expect(result.independentSourceCount).toBe(3);
  });

  it('does not count duplicate windows as persistence', () => {
    const result = evaluateEvidenceConfidence({
      identity,
      observations,
      windows: [
        { start: '1', end: '2' },
        { start: '1', end: '2' },
        { start: '1', end: '2' },
      ],
    });

    expect(result.windowCount).toBe(1);
    expect(result.status).toBe('supported');
  });

  it('ignores invalid windows', () => {
    const result = evaluateEvidenceConfidence({
      identity,
      observations,
      windows: [
        { start: '3', end: '2' },
        { start: '2', end: '2' },
        { start: '1', end: '2' },
      ],
    });

    expect(result.windowCount).toBe(1);
  });
});
