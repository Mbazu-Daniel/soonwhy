import { describe, expect, it } from 'vitest';
import { EMPTY_TRACE_FILTERS, hasTraceFilters, traceFilterParams } from './trace-search';

const range = { from: '2026-11-14T00:00:00.000Z', to: '2026-11-15T00:00:00.000Z' };

describe('trace filter params', () => {
  it('sends only the filters that are set', () => {
    expect(traceFilterParams(EMPTY_TRACE_FILTERS, range).toString()).toBe(new URLSearchParams(range).toString());
    const params = traceFilterParams({ ...EMPTY_TRACE_FILTERS, service: 'web', status: 'error', minDuration: '0', maxDuration: 'abc' }, range);
    expect(params.get('service')).toBe('web');
    expect(params.get('status')).toBe('error');
    expect(params.get('minDuration')).toBe('0');
    expect(params.has('maxDuration')).toBe(false);
    expect(traceFilterParams({ ...EMPTY_TRACE_FILTERS, traceIds: 'a,b' }, range).get('traceIds')).toBe('a,b');
  });

  it('knows when any filter is active', () => {
    expect(hasTraceFilters(EMPTY_TRACE_FILTERS)).toBe(false);
    expect(hasTraceFilters({ ...EMPTY_TRACE_FILTERS, operation: 'GET /' })).toBe(true);
    expect(hasTraceFilters({ ...EMPTY_TRACE_FILTERS, traceIds: 'a' })).toBe(true);
  });
});
