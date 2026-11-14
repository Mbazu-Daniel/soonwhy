import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { traceFilterParams, type TraceFilterState, type TraceListItem, type TraceStatBucket } from '~/lib/trace-search';

interface Range { from: string; to: string }

export function useTracePages(projectId: string | null | undefined, filters: TraceFilterState, getRange: () => Range, rangeKey: string, refetchMs: number | false) {
  return useInfiniteQuery({
    queryKey: ['trace-pages', projectId, filters, rangeKey],
    queryFn: ({ pageParam }) => {
      const params = traceFilterParams(filters, getRange());
      params.set('limit', '20');
      if (pageParam) params.set('cursor', pageParam);
      return api.get<{ data: TraceListItem[]; nextCursor?: string }>(`/projects/${projectId}/traces?${params.toString()}`);
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor || undefined,
    enabled: !!projectId,
    placeholderData: keepPreviousData,
    refetchInterval: refetchMs,
  });
}

export function useTraceStats(projectId: string | null | undefined, filters: TraceFilterState, getRange: () => Range, rangeKey: string) {
  return useQuery({
    queryKey: ['trace-stats', projectId, filters, rangeKey],
    queryFn: () => api.get<{ interval: string; buckets: TraceStatBucket[] }>(`/projects/${projectId}/traces/stats?${traceFilterParams(filters, getRange()).toString()}`),
    enabled: !!projectId,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useSpanLogCounts(projectId: string | null | undefined, traceId: string | undefined) {
  return useQuery({
    queryKey: ['span-log-counts', projectId, traceId],
    queryFn: () => api.get<{ counts: Record<string, number> }>(`/projects/${projectId}/traces/${encodeURIComponent(traceId!)}/log-counts`),
    enabled: !!projectId && !!traceId,
    retry: false,
  });
}
