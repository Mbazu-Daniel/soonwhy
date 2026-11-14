import type { LogRange } from '~/lib/log-range';
import type { LogFilterChip } from '~/lib/log-types';

export interface LogViewState {
  q: string;
  level: string;
  range: LogRange;
  customFrom: string;
  customTo: string;
  chips: LogFilterChip[];
}

export interface LogsSearch {
  service?: string;
  traceId?: string;
  spanId?: string;
  q?: string;
  level?: string;
  range?: string;
  from?: string;
  to?: string;
  f?: string;
  view?: string;
}

export const DEFAULT_LOG_VIEW: LogViewState = { q: '', level: 'all', range: '24h', customFrom: '', customTo: '', chips: [] };

const LEVELS = ['all', 'fatal', 'error', 'warn', 'info', 'debug'];
const RANGES: string[] = ['1h', '6h', '24h', '7d', 'custom', 'all'];
const MAX_CHIPS = 20;
const MAX_TEXT = 2000;

function text(value: unknown, max = MAX_TEXT): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export function parseChips(raw: unknown): LogFilterChip[] {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_CHIPS).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { field, value: chipValue, negate } = item as Record<string, unknown>;
    if (typeof field !== 'string' || !field || typeof chipValue !== 'string') return [];
    return [{ field: field.slice(0, 160), value: chipValue.slice(0, 500), negate: negate === true }];
  });
}

export function sanitizeView(raw: unknown): LogViewState {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const range = typeof source.range === 'string' && RANGES.includes(source.range) ? (source.range as LogRange) : DEFAULT_LOG_VIEW.range;
  const level = typeof source.level === 'string' && LEVELS.includes(source.level) ? source.level : 'all';
  return {
    q: text(source.q),
    level,
    range,
    customFrom: text(source.customFrom, 40),
    customTo: text(source.customTo, 40),
    chips: parseChips(source.chips),
  };
}

export function viewFromSearch(search: LogsSearch): LogViewState {
  const chips = parseChips(search.f);
  const extra: Array<[string, string | undefined]> = [['service', search.service], ['traceId', search.traceId], ['spanId', search.spanId]];
  for (const [field, value] of extra) {
    if (value && !chips.some((chip) => chip.field === field && chip.value === value && !chip.negate)) chips.push({ field, value, negate: false });
  }
  return sanitizeView({
    q: search.q,
    level: search.level,
    range: search.range,
    customFrom: search.from,
    customTo: search.to,
    chips,
  });
}

export function viewToSearch(view: LogViewState): Record<string, string> {
  const search: Record<string, string> = {};
  if (view.q.trim()) search.q = view.q.trim();
  if (view.level !== 'all') search.level = view.level;
  if (view.range !== DEFAULT_LOG_VIEW.range) search.range = view.range;
  if (view.range === 'custom') {
    if (view.customFrom) search.from = view.customFrom;
    if (view.customTo) search.to = view.customTo;
  }
  if (view.chips.length) search.f = JSON.stringify(view.chips);
  return search;
}

export function shareUrl(view: LogViewState, origin: string, pathname: string): string {
  const query = new URLSearchParams(viewToSearch(view)).toString();
  return `${origin}${pathname}${query ? `?${query}` : ''}`;
}
