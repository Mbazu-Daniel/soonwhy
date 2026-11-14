import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, Clock3, ChevronRight, X, FileText, ExternalLink } from 'lucide-react';
import { ConnectServiceButton } from '~/components/connect-service-button';
import { useMemo, useState } from 'react';
import { TraceWaterfall } from '~/components/trace/trace-waterfall';
import { TraceServiceGraph } from '~/components/trace/trace-service-graph';
import { buildTraceLayout, formatMs } from '~/components/trace/trace.layout';
import type { TraceSpan } from '~/components/trace/trace.types';
import { telemetryRangeParams, type TelemetryRange } from '~/components/telemetry/time-range-control';
import { TraceCharts } from '~/components/traces/trace-charts';
import { TraceFilterBar } from '~/components/traces/trace-filter-bar';
import { EMPTY_TRACE_FILTERS, hasTraceFilters, type TraceFilterState } from '~/lib/trace-search';
import { useDebounced } from '~/lib/use-debounced';
import { useSpanLogCounts, useTracePages, useTraceStats } from '~/lib/use-trace-search';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { Badge } from '~/components/ui/badge';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/traces')({
  component: TraceExplorer,
});

interface TraceResponse {
  traceId: string;
  spans: TraceSpan[];
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
  const [filters, setFilters] = useState<TraceFilterState>({ ...EMPTY_TRACE_FILTERS, service: serviceFilter ?? '' });
  const [range, setRange] = useState<TelemetryRange>('24h');
  const [selectedTraceId, setSelectedTraceId] = useState<string>();
  const rangeParams = telemetryRangeParams(range);

  const applied = useDebounced(filters);
  const pages = useTracePages(projectId, applied, rangeParams, range, 15_000);
  const stats = useTraceStats(projectId, applied, rangeParams, range);
  const services = useQuery({
    queryKey: ['trace-filter-services', projectId],
    queryFn: () => api.get<Array<{ name: string }>>(`/projects/${projectId}/services`),
    enabled: !!projectId,
    retry: false,
  });
  const traces = useMemo(() => {
    const seen = new Set<string>();
    return (pages.data?.pages.flatMap((page) => page.data) ?? []).filter((trace) => !seen.has(trace.traceId) && !!seen.add(trace.traceId));
  }, [pages.data]);
  const { isLoading, isError, refetch } = pages;
  const spanLogCounts = useSpanLogCounts(projectId, selectedTraceId);

  const selectedTrace = useQuery({
    queryKey: ['trace-drawer', projectId, selectedTraceId],
    queryFn: () => api.get<TraceResponse>(`/projects/${projectId}/traces/${encodeURIComponent(selectedTraceId!)}`),
    enabled: !!projectId && !!selectedTraceId,
  });

  const layout = useMemo(() => buildTraceLayout(selectedTrace.data?.spans ?? []), [selectedTrace.data]);
  const firstSpan = layout.rows[0]?.span;
  const traceLogs = useQuery({
    queryKey: ['trace-drawer-logs', projectId, selectedTraceId],
    queryFn: () =>
      api.get<{ data: LogEntry[] }>(
        `/projects/${projectId}/logs?traceId=${encodeURIComponent(selectedTraceId!)}&limit=12`,
      ),
    enabled: !!projectId && !!selectedTraceId,
  });

  if (!projectId) return <Empty />;
  const showingStale = isError && traces.length > 0;
  if (isError && traces.length === 0) return <QueryErrorState onRetry={() => void refetch()} />;

  return (
    <div className="min-h-full space-y-5 pb-8">
      <h1 className="sr-only">Traces</h1>

      <TraceFilterBar filters={filters} onChange={setFilters} services={(services.data ?? []).map((item) => item.name)} range={range} onRange={setRange} />
      <TraceCharts buckets={stats.data?.buckets ?? []} />

      {showingStale && <div className="flex items-center justify-between gap-3 rounded-xl border border-[#5A4A1C] bg-[#2A220F] px-4 py-3 text-xs text-[#D8C68A]"><span>Trace telemetry is temporarily unavailable. Showing the last successful result.</span><button type="button" onClick={() => void refetch()} className="rounded-md border px-2 py-1 hover:bg-background">Retry</button></div>}

      <Card className="overflow-hidden border-border shadow-none">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : traces.length === 0 ? (
            <div className="p-12 text-center">
              <GitBranch className="mx-auto h-8 w-8 text-[#16931F]" />
              <p className="mt-3 font-medium">{hasTraceFilters(applied) ? 'No traces found' : 'Waiting for your first trace'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasTraceFilters(applied) ? 'Try removing a filter or widening the time range.' : 'Send a real request through your project instrumentation to activate trace exploration.'}
              </p>
              {!hasTraceFilters(applied) && <ConnectServiceButton className="mt-4" />}
            </div>
          ) : (
            <div className="divide-y divide-[#DBE5D7]">
              {traces.map((t) => (
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
                    <Badge variant="outline" className={t.status === 'error' ? 'border-[#F8C7C2] text-[#F28B82]' : ''}>{t.status}</Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pages.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" disabled={pages.isFetchingNextPage} onClick={() => void pages.fetchNextPage()}>{pages.isFetchingNextPage ? 'Loading…' : 'Load more'}</Button>
        </div>
      )}

      {selectedTraceId && (
        <>
          <button type="button" aria-label="Close trace inspector" onClick={() => setSelectedTraceId(undefined)} className="fixed inset-0 z-40 bg-black/20" />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16931F]"></p>
                <h2 className="mt-1 truncate font-mono text-sm font-semibold">{selectedTraceId}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{firstSpan?.name || 'Distributed trace'} · {firstSpan?.service || 'Multiple services'}</p>
              </div>
              <button type="button" onClick={() => setSelectedTraceId(undefined)} className="rounded-lg p-2 hover:bg-muted" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {selectedTrace.isLoading ? (
                <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-64" /><Skeleton className="h-40" /></div>
              ) : selectedTrace.isError || !selectedTrace.data?.spans.length ? (
                <div className="py-12 text-center text-sm text-muted-foreground">{selectedTrace.isError ? 'Could not load this trace.' : 'No spans were found for this trace yet. They may still be ingesting.'}<div className="mt-3"><button type="button" onClick={() => void selectedTrace.refetch()} className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">Retry</button></div></div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-4 gap-2">
                    <MiniMetric label="Duration" value={formatMs(layout.totalMs)} />
                    <MiniMetric label="Spans" value={String(layout.rows.length)} />
                    <MiniMetric label="Services" value={String(layout.services.length)} />
                    <MiniMetric label="Errors" value={String(layout.errorCount)} />
                  </div>

                  <section>
                    <h3 className="text-sm font-semibold">Service map</h3>
                    <div className="mt-3 rounded-lg border p-2"><TraceServiceGraph spans={selectedTrace.data.spans} services={layout.services} /></div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold">Waterfall</h3>
                    <div className="mt-3 overflow-hidden rounded-lg border"><TraceWaterfall layout={layout} compact logCounts={spanLogCounts.data?.counts} /></div>
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
                    <ExternalLink className="h-3.5 w-3.5" />Open trace
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
