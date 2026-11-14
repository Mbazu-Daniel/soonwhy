import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import type { LogFieldName, LogFieldValue, LogHistogram, LogPage } from '~/lib/log-types';

export interface LogSearchParams {
  projectId: string | null | undefined;
  rangeKey: string;
  getWindow: () => { from: string; to: string };
  level: string;
  service: string;
  q: string;
}

function paramsOf(search: LogSearchParams, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ ...search.getWindow(), ...extra });
  if (search.level !== 'all') params.set('level', search.level);
  if (search.service) params.set('service', search.service);
  if (search.q) params.set('q', search.q);
  return params.toString();
}

export function exportParams(search: LogSearchParams, format: 'ndjson' | 'csv'): string {
  return paramsOf(search, { format, limit: '1000' });
}

export function useLogPages(search: LogSearchParams, refetchMs: number | false) {
  return useInfiniteQuery({
    queryKey: ['log-pages', search.projectId, search.level, search.service, search.q, search.rangeKey],
    queryFn: ({ pageParam }) =>
      api.get<LogPage>(`/projects/${search.projectId}/logs?${paramsOf(search, { limit: '50', ...(pageParam ? { cursor: pageParam } : {}) })}`),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor || undefined,
    enabled: !!search.projectId,
    refetchInterval: refetchMs,
    placeholderData: keepPreviousData,
    retry: (count, error) => !(error instanceof Error && /Invalid search query/.test(error.message)) && count < 2,
  });
}

export function useLogHistogram(search: LogSearchParams, refetchMs: number | false) {
  return useQuery({
    queryKey: ['log-histogram', search.projectId, search.level, search.service, search.q, search.rangeKey],
    queryFn: () => api.get<LogHistogram>(`/projects/${search.projectId}/logs/histogram?${paramsOf(search)}`),
    enabled: !!search.projectId,
    refetchInterval: refetchMs,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useLogFields(search: LogSearchParams) {
  return useQuery({
    queryKey: ['log-fields', search.projectId, search.level, search.service, search.q, search.rangeKey],
    queryFn: () => api.get<{ data: LogFieldName[] }>(`/projects/${search.projectId}/logs/fields?${paramsOf(search)}`),
    enabled: !!search.projectId,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useLogFieldValues(search: LogSearchParams, field: string | null) {
  return useQuery({
    queryKey: ['log-field-values', search.projectId, field, search.level, search.service, search.q, search.rangeKey],
    queryFn: () => api.get<{ data: LogFieldValue[] }>(`/projects/${search.projectId}/logs/fields/values?${paramsOf(search, { field: field!, size: '10' })}`),
    enabled: !!search.projectId && !!field,
    retry: false,
  });
}
