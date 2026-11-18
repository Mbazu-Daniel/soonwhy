import { describe, expect, it } from 'vitest';
import { statusShare } from './request-summary';

describe('statusShare', () => {
  const counts = { _2xx: 90, _3xx: 0, _4xx: 5, _5xx: 5 };

  it('is the rounded percentage of all responses', () => {
    expect(statusShare(counts, '_2xx')).toBe(90);
    expect(statusShare(counts, '_5xx')).toBe(5);
    expect(statusShare(counts, '_3xx')).toBe(0);
  });

  it('is zero when there are no responses', () => {
    expect(statusShare({ _2xx: 0, _3xx: 0, _4xx: 0, _5xx: 0 }, '_2xx')).toBe(0);
  });
});
