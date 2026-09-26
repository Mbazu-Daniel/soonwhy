import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, GitBranch, Clock3, FileText, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { Badge } from '~/components/ui/badge';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/trace/$traceId')({ component: TraceDetail });

interface Span {
  id: string;
  traceId: string;
  parentSpanId: string | null;
  service: string;
  operation: string;
  durationMs: number;
  startTime: string;
  status: string;
  attributes: Record<string, unknown> | null;
  events: Array<{ name: string; timestamp: string }>;
}

function TraceDetail() {
  const { organizationSlug, projectSlug, traceId } = Route.useParams();
  const { projectId } = useProject();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['trace', projectId, traceId],
    queryFn: () => api.get<Span[]>(`/projects/${projectId}/traces/${traceId}`),
    enabled: !!projectId && !!traceId,
  });

  if (!projectId) return <Card><CardContent className="p-10 text-center">Choose a project</CardContent></Card>;
  if (isError) return <QueryErrorState onRetry={() => void refetch()} />;

  const spans = data ?? [];
  const totalDuration = spans.reduce((max, span) => Math.max(max, span.durationMs), 0);
  const root = spans.find((span) => !span.parentSpanId) ?? spans[0];

  return (
    <div className="min-h-full space-y-5 pb-8">
      <Link to="/$organizationSlug/p/$projectSlug/traces" params={{ organizationSlug, projectSlug }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Traces
      </Link>

      <header>
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16931F]">Trace detail</p>
        <h1 className="mt-1 break-all font-mono text-xl font-semibold">{traceId}</h1>
        {root && <p className="mt-1 text-sm text-muted-foreground">{root.operation} · {root.service}</p>}
      </header>

      {isLoading ? <Skeleton className="h-[560px]" /> : !spans.length ? (
        <Card><CardContent className="p-12 text-center"><p className="font-medium">Trace not found</p><p className="mt-1 text-sm text-muted-foreground">The trace may have expired or is not available for this project.</p></CardContent></Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Metric label="Duration" value={`${totalDuration}ms`} />
            <Metric label="Spans" value={spans.length.toLocaleString()} />
            <Metric label="Services" value={new Set(spans.map((span) => span.service)).size.toLocaleString()} />
          </section>

          <Card className="overflow-hidden border-border shadow-none">
            <CardHeader className="border-b bg-muted">
              <div className="flex items-center justify-between gap-3">
                <div><CardTitle className="text-base">Waterfall</CardTitle><p className="mt-1 text-xs text-muted-foreground">Service and operation timing across the request</p></div>
                <Badge variant="outline">{root?.status ?? 'unknown'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {spans.map((span, index) => {
                const width = totalDuration > 0 ? Math.max(3, (span.durationMs / totalDuration) * 100) : 3;
                const depth = Math.min(index * 14, 112);
                return (
                  <div key={span.id} className="border-b border-border p-4 last:border-0">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <div className="flex min-w-0 items-center gap-3 lg:w-[360px]" style={{ paddingLeft: `${depth}px` }}>
                        <GitBranch className="h-3.5 w-3.5 shrink-0 text-[#16931F]" />
                        <div className="min-w-0"><p className="truncate text-sm font-medium">{span.operation}</p><p className="truncate text-xs text-muted-foreground">{span.service}</p></div>
                      </div>
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="h-7 flex-1 overflow-hidden rounded bg-muted"><div className="h-full rounded bg-[#8BD125]" style={{ width: `${width}%` }} /></div>
                        <span className="w-16 shrink-0 text-right font-mono text-xs">{span.durationMs}ms</span>
                      </div>
                      <Badge variant="outline" className="w-fit">{span.status}</Badge>
                    </div>
                    {(span.events?.length > 0 || span.attributes) && (
                      <div className="mt-3 ml-7 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {span.events?.length > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1"><FileText className="h-3 w-3" />{span.events.length} events</span>}
                        {span.attributes && Object.entries(span.attributes).slice(0, 6).map(([key, value]) => <span key={key} className="rounded-md bg-muted px-2 py-1 font-mono">{key}={String(value)}</span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border shadow-none">
              <CardHeader className="border-b"><CardTitle className="text-sm">Span events</CardTitle></CardHeader>
              <CardContent className="space-y-3 p-5">
                {spans.flatMap((span) => span.events.map((event) => ({ ...event, service: span.service, operation: span.operation }))).slice(0, 20).map((event, index) => (
                  <div key={`${event.service}-${event.timestamp}-${index}`} className="flex gap-3 text-xs">
                    <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div><p className="font-medium">{event.name}</p><p className="mt-0.5 text-muted-foreground">{event.service} · {event.operation} · {new Date(event.timestamp).toLocaleString()}</p></div>
                  </div>
                ))}
                {!spans.some((span) => span.events.length) && <p className="text-sm text-muted-foreground">No span events recorded.</p>}
              </CardContent>
            </Card>
            <Card className="border-border shadow-none">
              <CardHeader className="border-b"><CardTitle className="text-sm">Trace context</CardTitle></CardHeader>
              <CardContent className="space-y-3 p-5 text-xs">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Trace ID</span><span className="max-w-[70%] break-all font-mono text-right">{traceId}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Root service</span><span>{root?.service ?? '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Root operation</span><span>{root?.operation ?? '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Started</span><span>{root?.startTime ? new Date(root.startTime).toLocaleString() : '—'}</span></div>
                <Link to="/$organizationSlug/p/$projectSlug/logs" params={{ organizationSlug, projectSlug }} className="inline-flex items-center gap-1 text-[#16931F] hover:underline"><ExternalLink className="h-3 w-3" />Open logs</Link>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card className="border-border shadow-none"><CardContent className="p-4"><p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></CardContent></Card>;
}
