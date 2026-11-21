import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { EmptyProject } from '~/components/empty-state';
import { QueryErrorState } from '~/components/query-error-state';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { GRADE_CLASSES, TREND_LABELS } from '~/lib/endpoint-health.constants';
import type { EndpointHealth, EndpointHealthResponse } from '@soonwhy/shared/contracts';
import { formatMs } from '~/lib/format-ms';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/intelligence/api')({ component: ApiHealthPage });

function signed(value: number | null, suffix: string): string {
  if (value === null) return '';
  return `${value > 0 ? '+' : ''}${value}${suffix}`;
}

function EndpointRow({ endpoint }: { endpoint: EndpointHealth }) {
  const { trend } = endpoint;
  return (
    <tr className="border-t">
      <td className="px-4 py-3"><span className="mr-2 font-mono text-xs text-muted-foreground">{endpoint.method}</span><span className="font-mono text-sm">{endpoint.url}</span></td>
      <td className={`px-4 py-3 font-semibold ${GRADE_CLASSES[endpoint.grade]}`}>{endpoint.grade} · {endpoint.score}</td>
      <td className="px-4 py-3 font-mono text-xs">{formatMs(endpoint.p95)}</td>
      <td className="px-4 py-3 font-mono text-xs">{endpoint.errorRate}%</td>
      <td className="px-4 py-3 font-mono text-xs">{endpoint.count}</td>
      <td className="px-4 py-3">
        <Badge variant={trend.status === 'regressing' ? 'destructive' : 'outline'}>{TREND_LABELS[trend.status]}</Badge>
        <span className="ml-2 text-xs text-muted-foreground">{[signed(trend.p95ChangePct, '% p95'), signed(trend.errorRateChange, ' pts errors')].filter(Boolean).join(' · ')}</span>
      </td>
    </tr>
  );
}

function ApiHealthPage() {
  const { projectId } = useProject();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['api-health', projectId],
    queryFn: () => api.get<EndpointHealthResponse>(`/requests/endpoints?projectId=${encodeURIComponent(projectId ?? "")}`),
    enabled: !!projectId,
  });

  if (!projectId) return <EmptyProject />;
  if (isError) return <QueryErrorState onRetry={() => void refetch()} />;
  if (isLoading) return <Skeleton className="h-64" />;
  if (!data || !Array.isArray(data.endpoints) || !data.endpoints.length) {
    return <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No requests in the last 24 hours.</CardContent></Card>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">API health</h1>
          <p className="text-sm text-muted-foreground">Last 24 hours compared with the 24 hours before. Scored on p95 latency, error rate and tail latency.</p>
        </div>
        {data.grade ? <div className={`text-4xl font-semibold ${GRADE_CLASSES[data.grade]}`} aria-label="API score">{data.grade} · {data.score}</div> : null}
      </div>
      <Card className="overflow-x-auto border-border shadow-none">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-3">Endpoint</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">p95</th><th className="px-4 py-3">Errors</th><th className="px-4 py-3">Requests</th><th className="px-4 py-3">Trend</th></tr>
          </thead>
          <tbody>{data.endpoints.map((endpoint) => <EndpointRow key={`${endpoint.method} ${endpoint.url}`} endpoint={endpoint} />)}</tbody>
        </table>
      </Card>
    </div>
  );
}
