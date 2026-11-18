import { describe, expect, it } from 'vitest';
import { formatMs, formatMsValue } from './format-ms';

describe('formatMs', () => {
  it('keeps two significant digits and drops trailing zeros', () => {
    expect(formatMsValue(123.456)).toBe('120');
    expect(formatMsValue(1.234)).toBe('1.2');
    expect(formatMsValue(0.5)).toBe('0.5');
    expect(formatMsValue(10)).toBe('10');
  });

  it('shows zero for a value that is not a number', () => {
    expect(formatMsValue(Number.NaN)).toBe('0');
    expect(formatMsValue(Number.POSITIVE_INFINITY)).toBe('0');
  });

  it('adds the unit', () => {
    expect(formatMs(1.234)).toBe('1.2ms');
  });
});
