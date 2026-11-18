import { describe, expect, it } from 'vitest';
import { clampInt } from './auto-analysis';

describe('clampInt', () => {
  it('keeps a value inside the range', () => {
    expect(clampInt('20', 1, 200, 5)).toBe(20);
  });
  it('clamps to the limits', () => {
    expect(clampInt('0', 1, 200, 5)).toBe(1);
    expect(clampInt('999', 1, 200, 5)).toBe(200);
  });
  it('falls back on text', () => {
    expect(clampInt('abc', 1, 200, 5)).toBe(5);
  });
});
