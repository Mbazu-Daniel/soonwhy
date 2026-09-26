import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, Gauge, Server, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { MetricCard } from '~/components/metric-cards';
import { api } from '~/lib/api';
import { ProductTour } from '~/components/product-tour';
import { dashboardOverview, type DashboardOverview } from '~/data/dashboard-overview';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/dashboard/projects/$projectSlug/')({
  component: DashboardOverviewPage,
});

function DashboardOverviewPage() {\n  const { projectSlug } = Route.useParams();
  const { projectId } = useProject();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview', projectId],
    queryFn: () => api.get<DashboardOverview>(`/projects/${projectId}/dashboard/overview`),
    enabled: !!projectId,
  });

  if (!projectId) {
    return (
      <div className="max-w-5xl mx-auto py-10">
        <Card className="border-dashed border-border bg-card">
          <CardContent className="p-12 text-center">
            <div className="mx-auto mb-4 h-11 w-11 rounded-xl bg-secondary grid place-items-center">
              <Server className="h-5 w-5 text-foreground" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Choose a project</h2>
            <p className="mt-2 text-sm text-muted-foreground">Select a project from the top bar to start exploring telemetry.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) return <OverviewSkeleton />;

  const live = data && data.totalRequests > 0 ? data : dashboardOverview;
  const score = live.score;
  const errorRate = live.errorRate;
  const requestRate = live.requestRate;
  const p95 = live.latencyP95;
  const p99 = live.latencyP99;
  const healthMessage = score >= 90 ? 'Everything looks healthy' : score >= 70 ? 'A few signals need attention' : 'Investigate system health';

  return (
    <div className="w-full space-y-5 pb-8 sm:space-y-6">
      <ProductTour />
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#16931F]">System overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Service health</h1>
          <p className="mt-1 text-sm text-muted-foreground">A live view of performance, errors and the signals SoonWhy is evaluating.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-[#16931F]" aria-hidden="true" />
          Last 24 hours
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] lg:gap-5">
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

        <Card className="bg-card">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Telemetry snapshot</p>
                <p className="mt-1 text-xs text-muted-foreground">Current application traffic and latency signals.</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
              <Snapshot label="Requests / sec" value={formatNumber(requestRate)} />
              <Snapshot label="Error rate" value={`${errorRate}%`} tone={errorRate > 1 ? 'critical' : 'positive'} />
              <Snapshot label="P95 latency" value={`${p95}ms`} />
              <Snapshot label="P99 latency" value={`${p99}ms`} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <MetricCard label="Total Requests" value={formatNumber(live.totalRequests)} icon={Activity} />
        <MetricCard label="Error Rate" value={`${live.errorRate}%`} icon={AlertTriangle} />
        <MetricCard label="P95 Latency" value={`${live.latencyP95}ms`} icon={Clock3} />
        <MetricCard label="Avg Latency" value={`${live.avgLatency}ms`} icon={TrendingUp} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <Card className="bg-card">
          <CardContent className="p-5 md:p-6">
            <SectionHeading title="Latency distribution" detail="Response time percentiles" />
            <div className="mt-6 space-y-5">
              <LatencyRow label="P50" value={live.latencyP50} max={p99 || 1} />
              <LatencyRow label="P95" value={p95} max={p99 || 1} />
              <LatencyRow label="P99" value={p99} max={p99 || 1} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-5 md:p-6">
            <SectionHeading title="HTTP status distribution" detail="Requests grouped by response class" />
            <div className="mt-5 divide-y divide-border">
              {live.statusCodes.length ? live.statusCodes.map((status) => (
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

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] xl:gap-5">
        <Card className="bg-card">
          <CardContent className="p-5 md:p-6">
            <SectionHeading title="What needs attention" detail="Signals requiring investigation" />
            <div className="mt-5 rounded-xl border border-dashed border-border bg-muted p-5 flex items-start gap-3">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-secondary grid place-items-center">
                <CheckCircle2 className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No active findings in this snapshot</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">SoonWhy will surface bottleneck detections here as telemetry accumulates enough evidence.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-secondary">
          <CardContent className="p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Intelligence</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">Find the reason, not just the symptom.</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Detections connect latency, errors, traces and service context into evidence you can inspect.</p>
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
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
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
    <div className="w-full mx-auto space-y-6">
      <div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-44" /><Skeleton className="h-4 w-96" /></div>
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
    </div>
  );
}
