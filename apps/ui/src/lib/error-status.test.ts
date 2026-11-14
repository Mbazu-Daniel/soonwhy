import { describe, expect, it } from 'vitest';
import { countByFilter, matchesFilter } from './error-status';

describe('error status filters', () => {
  it('treats unresolved and regressed as open', () => {
    expect(matchesFilter('unresolved', 'open')).toBe(true);
    expect(matchesFilter('regressed', 'open')).toBe(true);
    expect(matchesFilter('resolved', 'open')).toBe(false);
    expect(matchesFilter('ignored', 'open')).toBe(false);
  });

  it('matches exact statuses and everything for all', () => {
    expect(matchesFilter('resolved', 'resolved')).toBe(true);
    expect(matchesFilter('ignored', 'resolved')).toBe(false);
    expect(matchesFilter('ignored', 'all')).toBe(true);
  });

  it('counts each filter', () => {
    expect(countByFilter(['unresolved', 'regressed', 'resolved', 'ignored', 'ignored'])).toEqual({ open: 2, resolved: 1, ignored: 2, all: 5 });
  });
});
