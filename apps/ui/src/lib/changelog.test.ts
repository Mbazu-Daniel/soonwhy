import { describe, expect, it } from 'vitest';
import { CHANGELOG, sortedChangelog } from './changelog';

describe('changelog', () => {
  it('has well formed entries', () => {
    for (const entry of CHANGELOG) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.highlights.length).toBeGreaterThan(0);
    }
  });

  it('lists the newest entry first', () => {
    const dates = sortedChangelog([
      { date: '2026-01-01', title: 'a', highlights: ['x'] },
      { date: '2026-03-01', title: 'b', highlights: ['x'] },
    ]).map((entry) => entry.date);
    expect(dates).toEqual(['2026-03-01', '2026-01-01']);
  });
});
