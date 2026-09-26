import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ArrowLeft, Clock3, FileText, GitBranch, Copy, Check, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { Badge } from '~/components/ui/badge';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/trace/$traceId')({ component: TraceDetail });

interface Span {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  name: string;
  duration: number;
  timestamp: string;
  service: string;
  attributes?: Record<string, unknown>;
  resource?: Record<string, unknown>;
  status?: string;
  kind?: string;
  children: Span[];
}
interface TraceResponse { traceId: string; spans: Span[]; tree: Span[]; }
interface LogEntry { id: string; timestamp: string; level: string; message: string; traceId?: string; spanId?: string; }

function TraceDetail() {
  const { organizationSlug, projectSlug, traceId } = Route.useParams();
  const { projectId } = useProject();
  const [selectedSpanId, setSelectedSpanId] = useState<string>();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['trace', projectId, traceId],
    queryFn: () => api.get<TraceResponse>(`/projects/${projectId}/traces/${encodeURIComponent(traceId)}`),
    enabled: !!projectId && !!traceId,
  });

  const selected = data?.spans.find((span) => span.spanId === selectedSpanId) ?? data?.spans[0];
  const logs = useQuery({
    queryKey: ['trace-logs', projectId, traceId, selectedSpanId],
    queryFn: () => api.get<{ data: LogEntry[] }>(`/projects/${projectId}/logs?traceId=${encodeURIComponent(traceId)}${selectedSpanId ? `&spanId=${encodeURIComponent(selectedSpanId)}` : ''}&limit=20`),
    enabled: !!projectId && !!traceId,
  });

  const start = useMemo(() => data?.spans.reduce((min, span) => Math.min(min, new Date(span.timestamp).getTime()), Number.POSITIVE_INFINITY) ?? 0, [data]);
  const end = useMemo(() => data?.spans.reduce((max, span) => Math.max(max, new Date(span.timestamp).getTime() + span.duration), 0) ?? 0, [data]);
  const totalDuration = Math.max(0, end - start);
  const services = [...new Set(data?.spans.map((span) => span.service).filter(Boolean) ?? [])];

  if (!projectId) return <Card><CardContent className="p-10 text-center">Choose a project</CardContent></Card>;
  if (isError) return <QueryErrorState onRetry={() => void refetch()} />;

  async function copyTraceId() {
    await navigator.clipboard.writeText(traceId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="min-h-full space-y-5 pb-8">
      <div className="flex items-center justify-between gap-3">
        <Link to="/$organizationSlug/p/$projectSlug/traces" params={{ organizationSlug, projectSlug }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Traces</Link>
        <button type="button" onClick={copyTraceId} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy trace ID'}</button>
      </div>

      <header><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16931F]">Trace inspector</p><h1 className="mt-1 break-all font-mono text-xl font-semibold">{traceId}</h1><p className="mt-1 text-sm text-muted-foreground">{selected?.name ?? 'Distributed trace'} · {selected?.service ?? 'Unknown service'}</p></header>

      {isLoading ? <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-[520px]" /></div> : !data?.spans.length ? (
        <Card><CardContent className="p-12 text-center"><p className="font-medium">Trace not found</p><p className="mt-1 text-sm text-muted-foreground">The trace may have expired or is not available for this project.</p></CardContent></Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Duration" value={`${totalDuration.toFixed(1)}ms`} icon={Clock3} />
            <Metric label="Spans" value={String(data.spans.length)} icon={GitBranch} />
            <Metric label="Services" value={String(services.length)} icon={GitBranch} />
            <Metric label="Started" value={new Date(start).toLocaleTimeString()} icon={Clock3} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="overflow-hidden border-border shadow-none">
              <CardHeader className="border-b"><CardTitle className="text-base">Waterfall</CardTitle><p className="text-xs text-muted-foreground">Select a span to inspect its context.</p></CardHeader>
              <CardContent className="p-0">
                {data.spans.map((span) => {
                  const left = totalDuration ? Math.max(0, ((new Date(span.timestamp).getTime() - start) / totalDuration) * 100) : 0;
                  const width = totalDuration ? Math.max(1, (span.duration / totalDuration) * 100) : 1;
                  const depth = span.parentSpanId ? 16 : 0;
                  return <button key={span.spanId} type="button" onClick={() => setSelectedSpanId(span.spanId)} className={`grid w-full grid-cols-[minmax(180px,280px)_1fr] gap-3 border-b p-3 text-left hover:bg-muted ${selected?.spanId === span.spanId ? 'bg-muted' : ''}`}>
                    <div className="min-w-0" style={{ paddingLeft: depth }}><p className="truncate text-sm font-medium">{span.name}</p><p className="truncate font-mono text-[10px] text-muted-foreground">{span.service} · {span.spanId}</p></div>
                    <div className="relative flex items-center"><div className="absolute inset-x-0 h-1.5 rounded-full bg-muted" /><span className="absolute h-2 rounded-full bg-[#16931F]" style={{ left: `${left}%`, width: `${width}%` }} /><span className="ml-auto font-mono text-[10px] text-muted-foreground">{span.duration}ms</span></div>
                  </button>;
                })}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-border shadow-none"><CardHeader><CardTitle className="text-base">Span details</CardTitle></CardHeader><CardContent>{selected ? <div className="space-y-4">
                <div><p className="text-xs text-muted-foreground">Operation</p><p className="mt-1 text-sm font-medium">{selected.name}</p></div>
                <div className="grid grid-cols-2 gap-3"><Fact label="Service" value={selected.service} /><Fact label="Kind" value={selected.kind ?? '—'} /><Fact label="Status" value={selected.status ?? '—'} /><Fact label="Span ID" value={selected.spanId} /></div>
                <JsonBlock title="Attributes" value={selected.attributes} /><JsonBlock title="Resource" value={selected.resource} />
              </div> : <p className="text-sm text-muted-foreground">Select a span.</p>}</CardContent></Card>

              <Card className="border-border shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />{selectedSpanId ? 'Span logs' : 'Correlated logs'}</CardTitle></CardHeader><CardContent className="p-0">{logs.isLoading ? <div className="p-4"><Skeleton className="h-20" /></div> : !logs.data?.data?.length ? <p className="p-5 text-sm text-muted-foreground">No logs correlated with this span or trace.</p> : logs.data.data.slice(0, 8).map((log) => <div key={log.id} className="border-t p-3 first:border-0"><div className="flex items-center gap-2"><Badge variant="outline">{log.level}</Badge><span className="font-mono text-[10px] text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span></div><p className="mt-1 text-xs">{log.message}</p></div>)}</CardContent></Card>

              <Card className="border-border shadow-none"><CardHeader><CardTitle className="text-base">Trace context</CardTitle></CardHeader><CardContent className="space-y-3 text-xs"><Fact label="Trace ID" value={traceId} /><Fact label="Services" value={services.join(', ')} /><Link to="/$organizationSlug/p/$projectSlug/logs" params={{ organizationSlug, projectSlug }} className="inline-flex items-center gap-1 text-[#16931F] hover:underline"><ExternalLink className="h-3 w-3" />Open logs</Link></CardContent></Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) { return <Card className="border-border shadow-none"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-[#16931F]" /></div><p className="mt-2 text-xl font-semibold">{value}</p></CardContent></Card>; }
function Fact({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-all font-mono text-xs">{value}</p></div>; }
function JsonBlock({ title, value }: { title: string; value?: Record<string, unknown> }) { return <div><p className="text-xs text-muted-foreground">{title}</p><pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-[10px]">{JSON.stringify(value ?? {}, null, 2)}</pre></div>; }
