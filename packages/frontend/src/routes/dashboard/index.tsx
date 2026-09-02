import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { HealthScore } from '~/components/health-score';
import { MetricCard } from '~/components/metric-cards';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { Activity, AlertTriangle, Clock, TrendingUp } from 'lucide-react';

export const Route = createFileRoute('/dashboard/')({
  component: DashboardOverview,
});

interface OverviewData {
  score: number;
  errorRate: number;
  requestRate: number;
  avgLatency: number;
  totalRequests: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  statusCodes: { code: number; label: string; count: number; percentage: number }[];
}

function DashboardOverview() {
  const { projectId } = useProject();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview', projectId],
    queryFn: () => api.get<OverviewData>(`/dashboard/overview?projectId=${projectId}`),
    enabled: !!projectId,
  });

  if (!projectId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Overview</h2>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Select a project to view metrics</CardContent></Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Overview</h2>
        <Skeleton className="h-24 w-24" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Overview</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <HealthScore score={data?.score ?? 0} />
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              {data && data.score > 0
                ? `${data.requestRate} req/s, ${data.errorRate}% errors`
                : 'No data yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Requests" value={data?.totalRequests?.toLocaleString() ?? '—'} icon={Activity} />
        <MetricCard label="Error Rate" value={data ? `${data.errorRate}%` : '—'} icon={AlertTriangle} />
        <MetricCard label="P95 Latency" value={data ? `${data.latencyP95}ms` : '—'} icon={Clock} />
        <MetricCard label="Avg Latency" value={data ? `${data.avgLatency}ms` : '—'} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Latency Distribution</p>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">P50</span><span className="font-mono text-sm">{data?.latencyP50 ?? '—'}{data ? 'ms' : ''}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">P95</span><span className="font-mono text-sm">{data?.latencyP95 ?? '—'}{data ? 'ms' : ''}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">P99</span><span className="font-mono text-sm">{data?.latencyP99 ?? '—'}{data ? 'ms' : ''}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Status Codes</p>
            {data?.statusCodes?.map((sc) => (
              <div key={sc.label} className="flex items-center justify-between">
                <span className="text-sm">{sc.label}</span>
                <span className="font-mono text-sm">{sc.percentage}%</span>
              </div>
            )) ?? ['2xx', '3xx', '4xx', '5xx'].map((b) => (
              <div key={b} className="flex items-center justify-between"><span className="text-sm">{b}</span><span className="font-mono text-sm">—</span></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
