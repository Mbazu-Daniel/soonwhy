import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Search, GitBranch, Clock3, ChevronRight, X, FileText, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { TimeRangeControl, telemetryRangeParams, type TelemetryRange } from '~/components/telemetry/time-range-control';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Skeleton } from '~/components/ui/skeleton';
import { Badge } from '~/components/ui/badge';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/traces')({
  component: TraceExplorer,
});

interface Trace {
  traceId: string;
  rootService: string;
  rootOperation: string;
  durationMs: number;
  spanCount: number;
  status: string;
  startTime: string;
}

interface Span {
  spanId: string;
  parentSpanId?: string;
  name: string;
  duration: number;
  timestamp: string;
  service: string;
  status?: string;
}

interface TraceResponse {
  traceId: string;
  spans: Span[];
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  message: string;
}

function TraceExplorer() {
  const { projectSlug, orgSlug } = useProject();
  const { service: serviceFilter } = Route.useSearch() as { service?: string };
  const { projectId } = useProject();
  const [q, setQ] = useState('');
  const [range, setRange] = useState<TelemetryRange>('24h');
  const [selectedTraceId, setSelectedTraceId] = useState<string>();
  const rangeParams = telemetryRangeParams(range);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['traces', projectId, q, range],
    queryFn: () =>
      api.get<{ data: Trace[]; nextCursor?: string }>(
        `/projects/${projectId}/traces?${new URLSearchParams({ ...(q ? { q } : {}), ...(serviceFilter ? { service: serviceFilter } : {}), ...rangeParams }).toString()}`,
      ),
    enabled: !!projectId,
  });

  const selectedTrace = useQuery({
    queryKey: ['trace-drawer', projectId, selectedTraceId],
    queryFn: () => api.get<TraceResponse>(`/projects/${projectId}/traces/${encodeURIComponent(selectedTraceId!)}`),
    enabled: !!projectId && !!selectedTraceId,
  });

  const firstSpan = selectedTrace.data?.spans[0];
  const traceLogs = useQuery({
    queryKey: ['trace-drawer-logs', projectId, selectedTraceId],
    queryFn: () =>
      api.get<{ data: LogEntry[] }>(
        `/projects/${projectId}/logs?traceId=${encodeURIComponent(selectedTraceId!)}&limit=12`,
      ),
    enabled: !!projectId && !!selectedTraceId,
  });

  if (!projectId) return <Empty />;
  if (isError) return <QueryErrorState onRetry={() => void refetch()} />;

  return (
    <div className="min-h-full space-y-5 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16931F]">Distributed telemetry</p>
          <h1 className="mt-1 text-2xl font-semibold">Traces</h1>
          <p className="mt-1 text-sm text-muted-foreground">Follow a request across services and inspect its critical path.</p>
        </div>
        <TimeRangeControl value={range} onChange={setRange} />
      </header>

      <Card className="border-border shadow-none">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={serviceFilter ? `Traces for ${serviceFilter}` : "Search trace ID, service, or operation"}
              className="bg-muted pl-9"
              aria-label="Search traces"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border shadow-none">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : !data?.data?.length ? (
            <div className="p-12 text-center">
              <GitBranch className="mx-auto h-8 w-8 text-[#16931F]" />
              <p className="mt-3 font-medium">{q ? 'No traces found' : 'Waiting for your first trace'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {q ? 'Try a broader search or another trace ID, service, or operation.' : 'Send a real request through your project instrumentation to activate trace exploration.'}
              </p>
              {!q && <Link to="/onboarding" className="mt-4 inline-flex text-sm font-medium text-[#16931F] hover:underline">Open setup flow</Link>}
            </div>
          ) : (
            <div className="divide-y divide-[#DBE5D7]">
              {data.data.map((t) => (
                <button
                  key={t.traceId}
                  type="button"
                  onClick={() => setSelectedTraceId(t.traceId)}
                  className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted focus-visible:bg-muted"
                  aria-label={`Inspect trace ${t.traceId}`}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary"><GitBranch className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.rootOperation || 'Trace'}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{t.traceId} · {t.rootService || 'Multiple services'}</p>
                  </div>
                  <div className="hidden items-center gap-2 sm:flex">
                    <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono text-xs">{t.durationMs}ms</span>
                    <Badge variant="outline">{t.spanCount} spans</Badge>
                    <Badge variant="outline">{t.status}</Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTraceId && (
        <>
          <button type="button" aria-label="Close trace inspector" onClick={() => setSelectedTraceId(undefined)} className="fixed inset-0 z-40 bg-black/20" />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16931F]">Trace inspector</p>
                <h2 className="mt-1 truncate font-mono text-sm font-semibold">{selectedTraceId}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{firstSpan?.name || 'Distributed trace'} · {firstSpan?.service || 'Multiple services'}</p>
              </div>
              <button type="button" onClick={() => setSelectedTraceId(undefined)} className="rounded-lg p-2 hover:bg-muted" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {selectedTrace.isLoading ? (
                <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-64" /><Skeleton className="h-40" /></div>
              ) : selectedTrace.isError || !selectedTrace.data?.spans.length ? (
                <div className="py-12 text-center text-sm text-muted-foreground">This trace is no longer available.</div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-2">
                    <MiniMetric label="Spans" value={String(selectedTrace.data.spans.length)} />
                    <MiniMetric label="Services" value={String(new Set(selectedTrace.data.spans.map((span) => span.service)).size)} />
                    <MiniMetric label="Duration" value={`${Math.max(...selectedTrace.data.spans.map((span) => new Date(span.timestamp).getTime() + span.duration)) - Math.min(...selectedTrace.data.spans.map((span) => new Date(span.timestamp).getTime()))}ms`} />
                  </div>

                  <section>
                    <h3 className="text-sm font-semibold">Waterfall</h3>
                    <div className="mt-3 divide-y rounded-lg border">
                      {selectedTrace.data.spans.map((span) => (
                        <div key={span.spanId} className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{span.name}</p>
                              <p className="font-mono text-[10px] text-muted-foreground">{span.service} · {span.spanId}</p>
                            </div>
                            <Badge variant="outline">{span.duration}ms</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" />Correlated logs</h3>
                    <div className="mt-3 divide-y rounded-lg border">
                      {traceLogs.isLoading ? <div className="p-4"><Skeleton className="h-16" /></div> : !traceLogs.data?.data?.length ? (
                        <p className="p-4 text-sm text-muted-foreground">No logs correlated with this trace.</p>
                      ) : traceLogs.data.data.map((log) => (
                        <div key={log.id} className="p-3">
                          <div className="flex items-center gap-2"><Badge variant="outline">{log.level}</Badge><span className="text-[10px] text-muted-foreground">{log.service} · {new Date(log.timestamp).toLocaleTimeString()}</span></div>
                          <p className="mt-1 text-xs">{log.message}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <Link
                    to="/$organizationSlug/p/$projectSlug/trace/$traceId"
                    params={{ organizationSlug: orgSlug!, projectSlug: projectSlug!, traceId: selectedTraceId }}
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#16931F] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />Open full trace inspector
                  </Link>
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function Empty() {
  return <Card><CardContent className="p-10 text-center"><p className="font-medium">Choose a project</p><p className="mt-1 text-sm text-muted-foreground">Select a project to inspect traces.</p></CardContent></Card>;
}
