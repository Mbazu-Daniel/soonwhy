import { describe, expect, it } from 'vitest';
import { metricsInterval } from './metrics-interval';

const HOUR = 60 * 60 * 1000;

describe('metricsInterval', () => {
  it('uses five-minute buckets up to six hours', () => {
    expect(metricsInterval(HOUR)).toBe('5m');
    expect(metricsInterval(6 * HOUR)).toBe('5m');
  });

  it('uses hourly buckets up to two days', () => {
    expect(metricsInterval(6 * HOUR + 1)).toBe('1h');
    expect(metricsInterval(48 * HOUR)).toBe('1h');
  });

  it('uses daily buckets beyond two days', () => {
    expect(metricsInterval(48 * HOUR + 1)).toBe('1d');
    expect(metricsInterval(30 * 24 * HOUR)).toBe('1d');
  });
});
