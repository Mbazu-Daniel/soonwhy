import { createFileRoute, Link } from '@tanstack/react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BrainCircuit,
  ChevronDown,
  Clock3,
  Compass,
  GitBranch,
  Server,
} from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { api } from '~/lib/api';
import { dashboardOverview, type DashboardOverview } from '~/data/dashboard-overview';
import { useProject } from '~/lib/project-context';
import { useState } from 'react';
import { TimeRangeControl, telemetryRangeParams, type TelemetryRange } from '~/components/telemetry/time-range-control';
import { ConnectServiceButton } from '~/components/connect-service-button';
import { EmptyProject } from '~/components/empty-state';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/')({
  component: DashboardOverviewPage,
});

function AIDashboardSummary({ orgSlug, projectSlug }: { orgSlug: string; projectSlug: string }) {
  return (
    <section className="rounded-2xl border border-[#34451D] bg-[#11170D] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#ACFC15]/10 text-[#ACFC15]">
            <BrainCircuit className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#ACFC15]">AI summary</p>
            <h2 className="mt-1 text-sm font-semibold text-[#F6F6F6]">
              Your system looks stable, with a few signals worth watching.
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-[#A9B09F]">
              SoonWhy can turn connected traces, logs and findings into a short explanation of what changed,
              why it matters and where to investigate next.
            </p>
          </div>
        </div>
        <Link
          to="/$organizationSlug/p/$projectSlug/intelligence/investigations"
          params={{ organizationSlug: orgSlug!, projectSlug: projectSlug! }}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#34451D] px-3 py-2 text-xs font-medium text-[#ACFC15] hover:bg-[#ACFC15]/5"
        >
          Open AI investigation
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}

interface ServiceSummary {
  id: string;
  owner: { id: string; name: string | null; email: string } | null;
  team: { id: string; name: string; slug: string } | null;
}

function DashboardOverviewPage() {
  const { projectSlug, orgSlug } = useProject();
  const { projectId } = useProject();
  const [range, setRange] = useState<TelemetryRange>('24h');
  const rangeParams = telemetryRangeParams(range);

  const { data: telemetryStatus } = useQuery({
    queryKey: ['telemetry-status', projectId],
    queryFn: () => api.get<{ status: 'healthy' | 'stale' | 'waiting'; lastTelemetryAt: string | null }>(`/projects/${projectId}/dashboard/telemetry-status`),
    enabled: !!projectId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview', projectId, range],
    queryFn: () => api.get<DashboardOverview>(`/projects/${projectId}/dashboard/overview?${new URLSearchParams(rangeParams).toString()}`),
    enabled: !!projectId,
    placeholderData: keepPreviousData,
  });

  const { data: services } = useQuery({
    queryKey: ['services', projectId],
    queryFn: () => api.get<ServiceSummary[]>(`/projects/${projectId}/services`),
    enabled: !!projectId,
  });

  if (!projectId) {
    return (
      <div className="min-h-full space-y-5 pb-8">
        <EmptyProject />
      </div>
    );
  }

  if (isLoading) {
    return <OverviewSkeleton />;
  }

  const live = data && data.totalRequests > 0 ? data : dashboardOverview;
  const overviewStale = isLoading === false && !data && !!telemetryStatus?.lastTelemetryAt;
  const serviceCount = services?.length;
  const ownedCount = services?.filter((service) => service.owner || service.team).length;
  const ownershipPct = serviceCount ? Math.round(((ownedCount ?? 0) / serviceCount) * 100) : 0;

  return (
    <div className="min-h-full space-y-5 pb-8">
      <h1 className="sr-only">Overview</h1>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ConnectServiceButton appearance="secondary" />
        <TimeRangeControl value={range} onChange={setRange} />
        <ExploreEvidenceMenu orgSlug={orgSlug!} projectSlug={projectSlug!} />
      </div>

      {(telemetryStatus?.status === 'stale' || overviewStale) && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#5A4A1C] bg-[#2A220F] px-4 py-3 text-xs text-[#D8C68A]">
          <span>Telemetry is stale. Showing the last available result while new events are awaited.</span>
          <span className="shrink-0">{telemetryStatus.lastTelemetryAt ? new Date(telemetryStatus.lastTelemetryAt).toLocaleTimeString() : 'Unknown'}</span>
        </div>
      )}

      <AIDashboardSummary orgSlug={orgSlug!} projectSlug={projectSlug!} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Connected services" value={serviceCount == null ? '—' : String(serviceCount)} icon={Server} tone="dark" detail="Registered in this project" />
        <Metric label="Total requests" value={formatNumber(live.totalRequests)} icon={Activity} detail="Across monitored services" />
        <Metric label="Error rate" value={String(live.errorRate)} suffix="%" icon={AlertTriangle} detail="Application failures" />
        <Metric label="P95 latency" value={String(live.latencyP95)} suffix="ms" icon={Clock3} detail="Response time" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.8fr)]">
        <Card className="overflow-hidden rounded-xl border-[#242426] bg-[#0B0B0C]">
          <CardContent className="p-0">
            <div className="flex items-start justify-between border-b border-[#1B1B1D] px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-sm font-semibold text-[#F6F6F6]">Traffic & latency</h2>
                <p className="mt-1 text-xs text-[#989898]">Request volume and response-time health</p>
              </div>
              <span className="rounded-lg border border-[#242426] px-3 py-1.5 text-xs text-[#989898]">{range}</span>
            </div>
            <div className="px-5 pb-6 pt-4 sm:px-6">
              <div className="flex h-[260px] items-end gap-2 border-b border-[#1B1B1D]">
                {(data?.timeSeries || dashboardOverview.timeSeries || [])?.map(
                  (point, index) => (
                    <div key={index} className="group flex h-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-[5px] bg-[#415312] transition-colors group-hover:bg-[#ACFC15]"
                        style={{ height: `${point.normalizedHeight}%` }}
                      />
                    </div>
                  ),
                )}
              </div>
              <div className="mt-3 flex justify-between text-[10px] text-[#6E6E70]">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>Now</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-4 border-t border-[#1B1B1D] pt-5">
                <Mini label="Requests/sec" value={formatNumber(live.requestRate)} />
                <Mini label="P99 latency" value={`${live.latencyP99}ms`} />
                <Mini label="Avg latency" value={`${live.avgLatency}ms`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#242426] bg-[#182012] text-white">
          <CardContent className="flex h-full flex-col p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/55">Connected services</span>
              <Server className="h-4 w-4 text-[#8BD125]" />
            </div>
            <div className="mt-10">
              <div className="flex items-end gap-2">
                <span className="text-6xl font-semibold tracking-[-0.06em]">{serviceCount ?? '—'}</span>
                <span className="pb-2 text-sm text-white/40">services</span>
              </div>
              <Link
                to="/$organizationSlug/p/$projectSlug/services"
                params={{ organizationSlug: orgSlug!, projectSlug: projectSlug! }}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#8BD125] hover:underline"
              >
                View service inventory
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-auto pt-10">
              <div className="h-2 overflow-hidden rounded-full bg-[#0B0B0C]/10">
                <div
                  className="h-full rounded-full bg-[#ACFC15]"
                  style={{ width: `${serviceCount ? ownershipPct : 0}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-white/50">
                {ownedCount == null
                  ? 'Loading ownership coverage from the project registry.'
                  : `${ownedCount} of ${serviceCount} services have an owner or team assigned.`}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
  icon: Icon,
  detail,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: typeof Activity;
  detail: string;
  tone?: 'dark';
}) {
  return (
    <Card
      className={
        tone === 'dark'
          ? 'rounded-2xl border-[#182012] bg-[#182012] text-white'
          : 'rounded-2xl border-[#242426] bg-[#0B0B0C]'
      }
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className={tone === 'dark' ? 'text-xs text-white/55' : 'text-xs text-[#989898]'}>
            {label}
          </span>
          <Icon className={tone === 'dark' ? 'h-4 w-4 text-[#8BD125]' : 'h-4 w-4 text-[#ACFC15]'} />
        </div>
        <div className="mt-5 flex items-baseline gap-1">
          <span className="text-[28px] font-semibold tracking-[-0.04em]">{value}</span>
          {suffix ? (
            <span className={tone === 'dark' ? 'text-xs text-white/40' : 'text-xs text-[#6E6E70]'}>
              {suffix}
            </span>
          ) : null}
        </div>
        <p className={tone === 'dark' ? 'mt-2 text-xs text-white/45' : 'mt-2 text-xs text-[#6E6E70]'}>
          {detail}
        </p>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[.12em] text-[#6E6E70]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#F6F6F6]">{value}</p>
    </div>
  );
}

const EVIDENCE_DESTINATIONS = [
  {
    to: '/$organizationSlug/p/$projectSlug/services',
    icon: Server,
    label: 'Services',
    detail: 'Browse monitored services',
  },
  {
    to: '/$organizationSlug/p/$projectSlug/traces',
    icon: GitBranch,
    label: 'Traces',
    detail: 'Follow requests across services',
  },
  {
    to: '/$organizationSlug/p/$projectSlug/logs',
    icon: Activity,
    label: 'Logs',
    detail: 'Search raw log events',
  },
  {
    to: '/$organizationSlug/p/$projectSlug/intelligence/investigations',
    icon: BrainCircuit,
    label: 'Investigations',
    detail: 'AI-assisted root cause analysis',
  },
] as const;

function ExploreEvidenceMenu({ orgSlug, projectSlug }: { orgSlug: string; projectSlug: string }) {
  const params = { organizationSlug: orgSlug, projectSlug };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-[#ACFC15] px-3 py-2 text-xs font-semibold text-[#182012] transition-colors hover:bg-[#C2FF3D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ACFC15]/60"
          aria-label="Explore evidence"
        >
          <Compass className="h-4 w-4" />
          Explore evidence
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72 border-[#242426] bg-[#0B0B0C] p-2 text-[#F6F6F6]">
        {EVIDENCE_DESTINATIONS.map(({ to, icon: Icon, label, detail }) => (
          <DropdownMenuItem key={to} asChild className="rounded-lg px-2 py-2 focus:bg-[#151517] focus:text-[#F6F6F6]">
            <Link to={to} params={params} className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#151517] text-[#ACFC15]">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block truncate text-[11px] font-normal text-[#989898]">{detail}</span>
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#6E6E70]" />
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[390px] rounded-2xl" />
    </div>
  );
}

function formatNumber(value: number | undefined) {
  return value == null ? '—' : value.toLocaleString();
}
