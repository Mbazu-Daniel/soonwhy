import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, Gauge, Server, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { HealthScore } from '~/components/health-score';
import { MetricCard } from '~/components/metric-cards';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';

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
      <div className="max-w-5xl mx-auto py-10">
        <Card className="border-dashed bg-white">
          <CardContent className="p-12 text-center">
            <div className="mx-auto mb-4 h-11 w-11 rounded-xl bg-[#C9E7EB] grid place-items-center">
              <Server className="h-5 w-5 text-[#182012]" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Choose a project</h2>
            <p className="mt-2 text-sm text-muted-foreground">Select a project from the top bar to start exploring telemetry.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) return <OverviewSkeleton />;

  const score = data?.score ?? 0;
  const errorRate = data?.errorRate ?? 0;
  const requestRate = data?.requestRate ?? 0;
  const p95 = data?.latencyP95 ?? 0;
  const p99 = data?.latencyP99 ?? 0;
  const healthMessage = score >= 90 ? 'Everything looks healthy' : score >= 70 ? 'A few signals need attention' : 'Investigate system health';

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 pb-10">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#16931F]">System overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Service health</h1>
          <p className="mt-1 text-sm text-muted-foreground">A live view of performance, errors and the signals SoonWhy is evaluating.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-[#16931F]" aria-hidden="true" />
          Last 24 hours
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4">
        <Card className="bg-[#182012] text-white border-[#182012] overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/60">Health score</span>
              <Gauge className="h-4 w-4 text-[#8BD125]" />
            </div>
            <div className="mt-6 flex items-end gap-2">
              <span className="text-5xl font-semibold tracking-tight">{score}</span>
              <span className="pb-2 text-sm text-white/50">/ 100</span>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10" aria-label={`Health score ${score} out of 100`}>
              <div className="h-full rounded-full bg-[#8BD125] transition-all" style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
            </div>
            <p className="mt-4 text-sm text-white/70">{healthMessage}</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Telemetry snapshot</p>
                <p className="mt-1 text-xs text-muted-foreground">Current application traffic and latency signals.</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Snapshot label="Requests / sec" value={formatNumber(requestRate)} />
              <Snapshot label="Error rate" value={`${errorRate}%`} tone={errorRate > 1 ? 'critical' : 'positive'} />
              <Snapshot label="P95 latency" value={`${p95}ms`} />
              <Snapshot label="P99 latency" value={`${p99}ms`} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Requests" value={formatNumber(data?.totalRequests)} icon={Activity} />
        <MetricCard label="Error Rate" value={data ? `${data.errorRate}%` : '—'} icon={AlertTriangle} />
        <MetricCard label="P95 Latency" value={data ? `${data.latencyP95}ms` : '—'} icon={Clock3} />
        <MetricCard label="Avg Latency" value={data ? `${data.avgLatency}ms` : '—'} icon={TrendingUp} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white">
          <CardContent className="p-5 md:p-6">
            <SectionHeading title="Latency distribution" detail="Response time percentiles" />
            <div className="mt-6 space-y-5">
              <LatencyRow label="P50" value={data?.latencyP50 ?? 0} max={p99 || 1} />
              <LatencyRow label="P95" value={p95} max={p99 || 1} />
              <LatencyRow label="P99" value={p99} max={p99 || 1} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="p-5 md:p-6">
            <SectionHeading title="HTTP status distribution" detail="Requests grouped by response class" />
            <div className="mt-5 divide-y divide-[#DBE5D7]">
              {data?.statusCodes?.length ? data.statusCodes.map((status) => (
                <div key={status.label} className="py-3 flex items-center gap-3">
                  <span className="font-mono text-xs w-10 text-muted-foreground">{status.code}</span>
                  <span className="text-sm flex-1">{status.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{formatNumber(status.count)}</span>
                  <span className="w-14 text-right text-sm font-semibold">{status.percentage}%</span>
                </div>
              )) : (
                <div className="py-10 text-center text-sm text-muted-foreground">No status data yet.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <Card className="bg-white">
          <CardContent className="p-5 md:p-6">
            <SectionHeading title="What needs attention" detail="Signals requiring investigation" />
            <div className="mt-5 rounded-xl border border-dashed border-[#C9D8C5] bg-[#F7FAF4] p-5 flex items-start gap-3">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-[#C9E7EB] grid place-items-center">
                <CheckCircle2 className="h-4 w-4 text-[#182012]" />
              </div>
              <div>
                <p className="text-sm font-medium">No active findings in this snapshot</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">SoonWhy will surface bottleneck detections here as telemetry accumulates enough evidence.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#C9E7EB] border-[#C9E7EB]">
          <CardContent className="p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#182012]/60">Intelligence</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">Find the reason, not just the symptom.</h2>
            <p className="mt-2 text-sm leading-6 text-[#182012]/70">Detections connect latency, errors, traces and service context into evidence you can inspect.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Snapshot({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'critical' }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tracking-tight ${tone === 'positive' ? 'text-[#16931F]' : tone === 'critical' ? 'text-[#8A1C13]' : ''}`}>{value}</p>
    </div>
  );
}

function LatencyRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.min(100, Math.max(4, (value / max) * 100)) : 4;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <span className="font-mono text-xs font-medium">{value}ms</span>
      </div>
      <div className="h-2 rounded-full bg-[#EDF3E9] overflow-hidden">
        <div className="h-full rounded-full bg-[#8BD125]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function formatNumber(value: number | undefined) {
  if (value === undefined || value === null) return '—';
  return value.toLocaleString();
}

function OverviewSkeleton() {
  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      <div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-44" /><Skeleton className="h-4 w-96" /></div>
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
    </div>
  );
}
