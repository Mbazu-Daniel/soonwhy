import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, ArrowUpRight, BrainCircuit, CheckCircle2, Clock3, Gauge, GitBranch, Server, Zap } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { dashboardOverview, type DashboardOverview } from '~/data/dashboard-overview';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/dashboard')({
  component: DashboardOverviewPage,
});

function AIDashboardSummary({ organizationSlug }: { organizationSlug: string }) {
  return (
    <section className="rounded-2xl border border-[#34451D] bg-[#11170D] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#ACFC15]/10 text-[#ACFC15]">
            <BrainCircuit className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#ACFC15]">AI summary</p>
            <h2 className="mt-1 text-sm font-semibold text-[#F6F6F6]">Your system looks stable, with a few signals worth watching.</h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-[#A9B09F]">SoonWhy can turn connected traces, logs and detections into a short explanation of what changed, why it matters and where to investigate next.</p>
          </div>
        </div>
        <Link to="/$organizationSlug/investigations" params={{ organizationSlug }} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#34451D] px-3 py-2 text-xs font-medium text-[#ACFC15] hover:bg-[#ACFC15]/5">Open AI investigation <ArrowUpRight className="h-3.5 w-3.5"/></Link>
      </div>
    </section>
  );
}

function DashboardOverviewPage() {
  const { organizationSlug } = Route.useParams();
  const { projectId } = useProject();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview', projectId],
    queryFn: () => api.get<DashboardOverview>(`/dashboard/overview?projectId=${projectId}`),
    enabled: !!projectId,
  });

  if (!projectId) {
    return <EmptyProject />;
  }

  if (isLoading) return <OverviewSkeleton />;

  const live = data && data.totalRequests > 0 ? data : dashboardOverview;
  const score = live.score;
  const health = score >= 90 ? 'Healthy' : score >= 70 ? 'Needs attention' : 'Investigate';
  const healthTone = score >= 90 ? 'text-[#ACFC15]' : score >= 70 ? 'text-[#9A6500]' : 'text-[#8A1C13]';

  return (
    <div className="min-h-full w-full">
      <div className="mx-auto max-w-[1440px] space-y-5">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ACFC15]">Mission control</p>
            <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-[#F6F6F6]">Good morning, here’s your system.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#989898]">A quiet overview of traffic, reliability and the evidence SoonWhy has connected across your services.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#242426] bg-[#0B0B0C] px-3 py-2 text-xs text-[#989898] shadow-[0_1px_2px_rgba(24,32,18,.03)]">
            <span className="h-2 w-2 rounded-full bg-[#ACFC15]" />
            Last 24 hours
          </div>
        </header>

        <AIDashboardSummary organizationSlug={organizationSlug} />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Health score" value={String(score)} suffix="/100" icon={Gauge} tone="dark" detail={health} />
          <Metric label="Total requests" value={formatNumber(live.totalRequests)} icon={Activity} detail="Across monitored services" />
          <Metric label="Error rate" value={String(live.errorRate)} suffix="%" icon={AlertTriangle} detail="Application failures" />
          <Metric label="P95 latency" value={String(live.latencyP95)} suffix="ms" icon={Clock3} detail="Response time" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.8fr)]">
          <Card className="overflow-hidden rounded-xl border-[#242426] bg-[#0B0B0C] shadow-[0_8px_30px_rgba(24,32,18,.04)]">
            <CardContent className="p-0">
              <div className="flex items-start justify-between border-b border-[#1B1B1D] px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-sm font-semibold text-[#F6F6F6]">Traffic & latency</h2>
                  <p className="mt-1 text-xs text-[#989898]">Request volume and response-time health</p>
                </div>
                <button type="button" className="rounded-lg border border-[#242426] px-3 py-1.5 text-xs text-[#989898]">24h</button>
              </div>
              <div className="px-5 pb-6 pt-4 sm:px-6">
                <div className="flex h-[260px] items-end gap-2 border-b border-[#1B1B1D] pb-0">
                  {[36,48,43,62,56,70,64,76,68,82,74,88,80,91,84,96,87,78,86,72,81,67,75,63].map((height, index) => (
                    <div key={index} className="group flex h-full flex-1 items-end">
                      <div className="w-full rounded-t-[5px] bg-[#415312] transition-colors group-hover:bg-[#ACFC15]" style={{ height: `${height}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between text-[10px] text-[#6E6E70]"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Now</span></div>
                <div className="mt-5 grid grid-cols-3 gap-4 border-t border-[#1B1B1D] pt-5">
                  <Mini label="Requests/sec" value={formatNumber(live.requestRate)} />
                  <Mini label="P99 latency" value={`${live.latencyP99}ms`} />
                  <Mini label="Avg latency" value={`${live.avgLatency}ms`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[#242426] bg-[#182012] text-white shadow-[0_8px_30px_rgba(24,32,18,.08)]">
            <CardContent className="flex h-full flex-col p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/55">System health</span>
                <Zap className="h-4 w-4 text-[#8BD125]" />
              </div>
              <div className="mt-10">
                <div className="flex items-end gap-2">
                  <span className="text-6xl font-semibold tracking-[-0.06em]">{score}</span>
                  <span className="pb-2 text-sm text-white/40">/100</span>
                </div>
                <p className={`mt-3 text-sm font-medium ${healthTone.replace('text-[#ACFC15]', 'text-[#8BD125]').replace('text-[#9A6500]', 'text-[#F2C66D]').replace('text-[#8A1C13]', 'text-[#F28B82]')}`}>{health}</p>
              </div>
              <div className="mt-auto pt-10">
                <div className="h-2 overflow-hidden rounded-full bg-[#0B0B0C]/10"><div className="h-full rounded-full bg-[#ACFC15]" style={{ width: `${Math.min(100, score)}%` }} /></div>
                <p className="mt-3 text-xs leading-5 text-white/50">Based on latency, error rate and throughput signals from the current project.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
          <Card className="rounded-2xl border-[#242426] bg-[#0B0B0C] shadow-[0_8px_30px_rgba(24,32,18,.04)]">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-[#1B1B1D] px-5 py-5 sm:px-6">
                <div><h2 className="text-sm font-semibold">What needs attention</h2><p className="mt-1 text-xs text-[#989898]">Signals worth investigating</p></div>
                <Link to="/$organizationSlug/detections" params={{ organizationSlug }} className="text-xs font-medium text-[#ACFC15] hover:underline">View all</Link>
              </div>
              <div className="divide-y divide-[#EEF2EA]">
                <Attention icon={CheckCircle2} title="No active findings" detail="SoonWhy will surface evidence-backed bottlenecks here." tone="ok" />
                <Attention icon={GitBranch} title="Trace evidence connected" detail={`${formatNumber(live.totalRequests)} requests are represented in the current snapshot.`} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[#242426] bg-[#0B0B0C] shadow-[0_8px_30px_rgba(24,32,18,.04)]">
            <CardContent className="p-0">
              <div className="border-b border-[#1B1B1D] px-5 py-5 sm:px-6"><h2 className="text-sm font-semibold">Explore evidence</h2><p className="mt-1 text-xs text-[#989898]">Jump into the signals behind your system</p></div>
              <div className="grid grid-cols-2 gap-px bg-[#EEF2EA]">
                <QuickLink href="/$organizationSlug/services" params={{ organizationSlug }} icon={Server} label="Services" />
                <QuickLink href="/$organizationSlug/traces" params={{ organizationSlug }} icon={GitBranch} label="Traces" />
                <QuickLink href="/$organizationSlug/logs" params={{ organizationSlug }} icon={Activity} label="Logs" />
                <QuickLink href="/$organizationSlug/investigations" params={{ organizationSlug }} icon={BrainCircuit} label="Investigate" />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, suffix, icon: Icon, detail, tone }: { label:string; value:string; suffix?:string; icon:typeof Activity; detail:string; tone?:'dark' }) {
  return <Card className={tone === 'dark' ? 'rounded-2xl border-[#182012] bg-[#182012] text-white shadow-[0_8px_30px_rgba(24,32,18,.08)]' : 'rounded-2xl border-[#242426] bg-[#0B0B0C] shadow-[0_8px_30px_rgba(24,32,18,.04)]'}><CardContent className="p-5"><div className="flex items-center justify-between"><span className={tone === 'dark' ? 'text-xs text-white/55' : 'text-xs text-[#989898]'}>{label}</span><Icon className={tone === 'dark' ? 'h-4 w-4 text-[#8BD125]' : 'h-4 w-4 text-[#ACFC15]'} /></div><div className="mt-5 flex items-baseline gap-1"><span className="text-[28px] font-semibold tracking-[-0.04em]">{value}</span>{suffix&&<span className={tone === 'dark' ? 'text-xs text-white/40' : 'text-xs text-[#6E6E70]'}>{suffix}</span>}</div><p className={tone === 'dark' ? 'mt-2 text-xs text-white/45' : 'mt-2 text-xs text-[#6E6E70]'}>{detail}</p></CardContent></Card>;
}

function Mini({ label, value }: { label:string; value:string }) { return <div><p className="text-[10px] uppercase tracking-[.12em] text-[#6E6E70]">{label}</p><p className="mt-1 text-sm font-semibold text-[#F6F6F6]">{value}</p></div>; }
function Attention({ icon:Icon, title, detail, tone }: { icon:typeof CheckCircle2; title:string; detail:string; tone?:'ok' }) { return <div className="flex items-start gap-3 px-5 py-4 sm:px-6"><span className={tone === 'ok' ? 'grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF7E4] text-[#ACFC15]' : 'grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EAF3F4] text-[#26737A]'}><Icon className="h-4 w-4"/></span><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-[#989898]">{detail}</p></div></div>; }
function QuickLink({ href, params, icon:Icon, label }: { href:'/$organizationSlug/services'|'/$organizationSlug/traces'|'/$organizationSlug/logs'|'/$organizationSlug/investigations'; params:{organizationSlug:string}; icon:typeof Server; label:string }) { return <Link to={href} params={params} className="flex items-center gap-3 bg-[#0B0B0C] px-5 py-4 text-sm font-medium hover:bg-[#040405]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#151517] text-[#ACFC15]"><Icon className="h-4 w-4"/></span>{label}<ArrowUpRight className="ml-auto h-3.5 w-3.5 text-[#6E6E70]"/></Link>; }
function EmptyProject(){return <Card className="rounded-2xl border-dashed border-[#242426] bg-[#0B0B0C]"><CardContent className="p-12 text-center"><Server className="mx-auto h-6 w-6 text-[#ACFC15]"/><p className="mt-3 text-sm font-medium">Choose a project</p><p className="mt-1 text-xs text-[#989898]">Select a project from the top bar to start exploring telemetry.</p></CardContent></Card>;}
function OverviewSkeleton(){return <div className="w-full"><div className="mx-auto max-w-[1440px] space-y-6"><Skeleton className="h-10 w-72"/><Skeleton className="h-4 w-96 max-w-full"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(i=><Skeleton key={i} className="h-32 rounded-2xl"/>)}</div><Skeleton className="h-[390px] rounded-2xl"/></div></div>;}
function formatNumber(value:number|undefined){return value == null ? '—' : value.toLocaleString();}
