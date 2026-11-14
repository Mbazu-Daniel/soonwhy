export interface TraceFilterState {
  q: string;
  service: string;
  operation: string;
  status: 'all' | 'ok' | 'error';
  minDuration: string;
  maxDuration: string;
  traceIds: string;
}

export const EMPTY_TRACE_FILTERS: TraceFilterState = {
  q: '',
  service: '',
  operation: '',
  status: 'all',
  minDuration: '',
  maxDuration: '',
  traceIds: '',
};

export interface TraceListItem {
  traceId: string;
  rootService: string;
  rootOperation: string;
  durationMs: number;
  spanCount: number;
  errorCount?: number;
  status: string;
  startTime: string;
}

export interface TraceStatBucket {
  timestamp: string;
  requests: number;
  errors: number;
  avgMs: number;
  p95Ms: number;
}

export function traceFilterParams(filters: TraceFilterState, range: { from: string; to: string }): URLSearchParams {
  const params = new URLSearchParams(range);
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.service) params.set('service', filters.service);
  if (filters.operation.trim()) params.set('operation', filters.operation.trim());
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.minDuration !== '' && Number.isFinite(Number(filters.minDuration))) params.set('minDuration', filters.minDuration);
  if (filters.maxDuration !== '' && Number.isFinite(Number(filters.maxDuration))) params.set('maxDuration', filters.maxDuration);
  if (filters.traceIds) params.set('traceIds', filters.traceIds);
  return params;
}

export function hasTraceFilters(filters: TraceFilterState): boolean {
  return (Object.keys(EMPTY_TRACE_FILTERS) as Array<keyof TraceFilterState>).some((key) => filters[key] !== EMPTY_TRACE_FILTERS[key]);
}

export const RETENTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function retentionWindow(now = Date.now()): { from: string; to: string } {
  return { from: new Date(now - RETENTION_WINDOW_MS).toISOString(), to: new Date(now).toISOString() };
}
