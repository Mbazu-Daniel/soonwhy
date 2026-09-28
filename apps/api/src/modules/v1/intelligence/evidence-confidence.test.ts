import { describe, expect, it } from 'vitest';
import { evaluateEvidenceConfidence } from './evidence-confidence';

describe('evidence confidence', () => {
  const observations = [
    { name: 'latency', value: 900, source: 'metric' as const, observedAt: '1' },
    { name: 'query.duration', value: 700, source: 'database' as const, observedAt: '2' },
    { name: 'span.duration', value: 800, source: 'trace' as const, observedAt: '3' },
    { name: 'latency', value: 950, source: 'metric' as const, observedAt: '4' },
    { name: 'query.duration', value: 720, source: 'database' as const, observedAt: '5' },
  ];

  it('keeps sparse single-window evidence as a candidate', () => {
    const result = evaluateEvidenceConfidence({
      observations: observations.slice(0, 1),
      windows: [{ start: '1', end: '2' }],
    });
    expect(result.status).toBe('candidate');
  });

  it('requires repeated windows and multiple sources for confirmation', () => {
    const result = evaluateEvidenceConfidence({
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
});
