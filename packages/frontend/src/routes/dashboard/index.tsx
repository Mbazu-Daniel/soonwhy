import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { HealthScore } from '~/components/health-score';
import { MetricCard } from '~/components/metric-cards';
import { api } from '~/lib/api';
import { Activity, AlertTriangle, Clock, TrendingUp } from 'lucide-react';

export const Route = createFileRoute('/dashboard/')({
  component: DashboardOverview,
});

interface HealthData {
  score: number;
  errorRate: number;
  requestRate: number;
  avgLatency: number;
}

interface MetricsData {
  totalRequests: number;
  errorRate: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  statusCodes: { code: number; count: number; percentage: number }[];
}

function getProjectId(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('project_id') : null;
}

function DashboardOverview() {
  const projectId = getProjectId();

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['dashboard-health', projectId],
    queryFn: () => api.get<HealthData>(`/dashboard/health?projectId=${projectId}`),
    enabled: !!projectId,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-metrics', projectId],
    queryFn: () => api.get<MetricsData>(`/dashboard/metrics?projectId=${projectId}`),
    enabled: !!projectId,
  });

  if (!projectId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Overview</h2>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Select a project to view metrics
          </CardContent>
        </Card>
      </div>
    );
  }

  if (healthLoading || metricsLoading) {
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

  const statusGroups = metrics?.statusCodes?.reduce(
    (acc, sc) => {
      const bucket = sc.code < 300 ? '2xx' : sc.code < 400 ? '3xx' : sc.code < 500 ? '4xx' : '5xx';
      acc[bucket] = (acc[bucket] || 0) + sc.count;
      return acc;
    },
    {} as Record<string, number>,
  ) ?? {};

  const total = metrics?.totalRequests ?? 1;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Overview</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <HealthScore score={health?.score ?? 0} />
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              {health && health.score > 0
                ? `${health.requestRate} req/s, ${health.errorRate}% errors`
                : 'No data yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Requests" value={metrics?.totalRequests?.toLocaleString() ?? '—'} icon={Activity} />
        <MetricCard label="Error Rate" value={metrics ? `${metrics.errorRate}%` : '—'} icon={AlertTriangle} />
        <MetricCard label="P95 Latency" value={metrics ? `${metrics.latencyP95}ms` : '—'} icon={Clock} />
        <MetricCard label="Avg Latency" value={health ? `${health.avgLatency}ms` : '—'} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Latency Distribution</p>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">P50</span><span className="font-mono text-sm">{metrics?.latencyP50 ?? '—'}{metrics ? 'ms' : ''}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">P95</span><span className="font-mono text-sm">{metrics?.latencyP95 ?? '—'}{metrics ? 'ms' : ''}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">P99</span><span className="font-mono text-sm">{metrics?.latencyP99 ?? '—'}{metrics ? 'ms' : ''}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Status Codes</p>
            {['2xx', '3xx', '4xx', '5xx'].map((bucket) => (
              <div key={bucket} className="flex items-center justify-between">
                <span className="text-sm">{bucket}</span>
                <span className="font-mono text-sm">{statusGroups[bucket] ? `${Math.round((statusGroups[bucket] / total) * 100)}%` : '—'}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
