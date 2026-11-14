import { describe, expect, it } from 'vitest';
import { DEFAULT_LOG_VIEW, parseChips, sanitizeView, shareUrl, viewFromSearch, viewToSearch } from './log-view';

describe('log view state', () => {
  it('leaves defaults out of the link and round-trips the rest', () => {
    expect(viewToSearch(DEFAULT_LOG_VIEW)).toEqual({});
    const view = { ...DEFAULT_LOG_VIEW, q: 'timeout', level: 'error', range: '7d' as const, chips: [{ field: 'service', value: 'api', negate: true }] };
    expect(viewFromSearch(viewToSearch(view))).toEqual(view);
  });

  it('builds a share url', () => {
    expect(shareUrl({ ...DEFAULT_LOG_VIEW, q: 'a b' }, 'https://x.test', '/o/p/logs')).toBe('https://x.test/o/p/logs?q=a+b');
    expect(shareUrl(DEFAULT_LOG_VIEW, 'https://x.test', '/o/p/logs')).toBe('https://x.test/o/p/logs');
  });

  it('turns trace, span and service links into filters once', () => {
    const view = viewFromSearch({ traceId: 't1', spanId: 's1', service: 'api', f: JSON.stringify([{ field: 'service', value: 'api', negate: false }]) });
    expect(view.chips.map((chip) => `${chip.field}=${chip.value}`)).toEqual(['service=api', 'traceId=t1', 'spanId=s1']);
  });

  it('ignores malformed or hostile input', () => {
    expect(parseChips('not json')).toEqual([]);
    expect(parseChips([{ field: 5, value: 'x' }, null, { field: 'a', value: 'b' }])).toEqual([{ field: 'a', value: 'b', negate: false }]);
    expect(parseChips(Array.from({ length: 50 }, () => ({ field: 'a', value: 'b' })))).toHaveLength(20);
    expect(sanitizeView({ range: 'forever', level: 'loud', q: 5 })).toEqual(DEFAULT_LOG_VIEW);
  });
});
