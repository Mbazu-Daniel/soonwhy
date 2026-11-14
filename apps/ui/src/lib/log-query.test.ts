import { describe, expect, it } from 'vitest';
import { buildQuery, chipToken, quoteValue, sameChip } from './log-query';

describe('log query builder', () => {
  it('quotes and escapes values', () => {
    expect(quoteValue('say "hi" \\ now')).toBe('"say \\"hi\\" \\\\ now"');
  });

  it('turns chips into include and exclude tokens', () => {
    expect(chipToken({ field: 'level', value: 'error', negate: false })).toBe('level:"error"');
    expect(chipToken({ field: 'attributes.http.route', value: '/pay', negate: true })).toBe('NOT attributes.http.route:"/pay"');
  });

  it('joins text and chips with AND and wraps the free text', () => {
    expect(buildQuery('timeout OR reset', [{ field: 'service', value: 'api', negate: false }])).toBe('(timeout OR reset) AND service:"api"');
    expect(buildQuery('  ', [])).toBe('');
  });

  it('compares chips by field, value and sign', () => {
    const chip = { field: 'level', value: 'error', negate: false };
    expect(sameChip(chip, { ...chip })).toBe(true);
    expect(sameChip(chip, { ...chip, negate: true })).toBe(false);
  });
});
