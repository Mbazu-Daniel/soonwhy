import { describe, expect, it } from 'vitest';
import { IngestStats } from './stats';

describe('IngestStats', () => {
  it('tracks in-flight and peak request capacity', () => {
    const stats = new IngestStats();
    stats.beginRequest();
    stats.beginRequest();
    stats.endRequest();
    expect(stats.snapshot()).toMatchObject({ inFlight: 1, peakInFlight: 2 });
    stats.endRequest();
    stats.endRequest();
    expect(stats.snapshot()).toMatchObject({ inFlight: 0, peakInFlight: 2 });
  });
});
