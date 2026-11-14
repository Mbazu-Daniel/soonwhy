import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import type { RequestSummary } from '~/lib/request-summary';
import { telemetryRangeParams, type TelemetryRange } from '~/components/telemetry/time-range-control';

export const SUMMARY_REFRESH_MS = 15_000;

export function useRequestSummary(projectId: string | null | undefined, range: TelemetryRange, service = '') {
  return useQuery({
    queryKey: ['metrics-summary', projectId, range, service],
    queryFn: () => {
      const params = new URLSearchParams({ projectId: projectId!, ...telemetryRangeParams(range) });
      if (service) params.set('service', service);
      return api.get<RequestSummary>(`/metrics/summary?${params.toString()}`);
    },
    enabled: !!projectId,
    refetchInterval: SUMMARY_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}
