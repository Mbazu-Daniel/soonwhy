import { useMemo, useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { TimeRangeControl, telemetryRangeParams, type TelemetryRange } from '~/components/telemetry/time-range-control';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronDown, ChevronRight, SlidersHorizontal, RotateCcw, Download, Bookmark, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/logs')({ component: LogViewer });

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  message: string;
  attributes: string | Record<string, unknown>;
}

const LEVEL_TREATMENT: Record<string, string> = {
  info: 'bg-secondary text-[#182012] border-[#C9E7EB]',
  warn: 'bg-[#FEF3C7] text-[#713F12] border-[#FDE68A]',
  error: 'bg-[#FDE8E6] text-[#8A1C13] border-[#F8C7C2]',
  debug: 'bg-secondary text-[#4D5A4A] border-border',
};

function parseAttributes(attributes: LogEntry['attributes']) {
  if (typeof attributes === 'string') {
    try {
      return JSON.parse(attributes) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return attributes ?? {};
}

function LogRow({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const fields = parseAttributes(log.attributes);
  const expandable = Object.keys(fields).length > 0;

  return (
    <article className="border-b border-border last:border-0">
      <button
        type="button"
        aria-expanded={expandable ? expanded : undefined}
        onClick={() => expandable && setExpanded(!expanded)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted sm:items-center"
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center">
          {expandable ? (expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : null}
        </span>
        <time className="w-auto shrink-0 font-mono text-[11px] text-muted-foreground sm:w-40">
          {new Date(log.timestamp).toLocaleString()}
        </time>
        <Badge variant="outline" className={`w-14 shrink-0 justify-center text-[10px] uppercase ${LEVEL_TREATMENT[log.level] ?? LEVEL_TREATMENT.debug}`}>
          {log.level}
        </Badge>
        <span className="hidden w-32 shrink-0 truncate text-xs font-medium text-[#16931F] sm:block">{log.service}</span>
        <span className="min-w-0 flex-1 truncate">{log.message}</span>
      </button>
      {expanded && (
        <div className="bg-muted px-12 pb-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 text-xs leading-5">{JSON.stringify(fields, null, 2)}</pre>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Log context</p>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Service</dt><dd className="font-medium">{log.service}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Level</dt><dd className="font-medium uppercase">{log.level}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Timestamp</dt><dd className="font-mono">{new Date(log.timestamp).toLocaleTimeString()}</dd></div>
                {(fields.traceId || fields.spanId) && <div className="mt-3 border-t pt-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Correlation</p><div className="mt-2 flex flex-wrap gap-2">{fields.traceId && <Link to="/$organizationSlug/p/$projectSlug/trace/$traceId" params={{ organizationSlug: Route.useParams().organizationSlug, projectSlug: Route.useParams().projectSlug, traceId: String(fields.traceId) }} className="inline-flex items-center gap-1 text-xs font-medium text-[#16931F] hover:underline">View trace <ExternalLink className="h-3 w-3" /></Link>}</div></div>}
              </dl>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function LogViewer() {
  const { projectId } = useProject();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const routeSearch = Route.useSearch() as { service?: string; traceId?: string; spanId?: string };
  const initialService = routeSearch.service ?? 'all';
  const [serviceFilter, setServiceFilter] = useState(initialService);\n  const [cursor, setCursor] = useState<string>();
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [range, setRange] = useState<TelemetryRange>('24h');
  const [live, setLive] = useState(false);
  const { organizationSlug, projectSlug } = Route.useParams();
  const rangeParams = telemetryRangeParams(range);
    const traceIdFilter = routeSearch.traceId;
  const spanIdFilter = routeSearch.spanId;

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['logs', projectId, levelFilter, serviceFilter, search, cursor, range, live, traceIdFilter, spanIdFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (levelFilter !== 'all') params.set('level', levelFilter);
      if (serviceFilter !== 'all') params.set('service', serviceFilter);
      if (search) params.set('q', search);
      if (traceIdFilter) params.set('traceId', traceIdFilter);
      if (spanIdFilter) params.set('spanId', spanIdFilter);
      if (cursor) params.set('cursor', cursor);
      Object.entries(rangeParams).forEach(([key, value]) => params.set(key, value));
      params.set('limit', '50');
      return api.get<{ data: LogEntry[]; nextCursor?: string }>(`/projects/${projectId}/logs?${params.toString()}`);
    },
    enabled: !!projectId,
    refetchInterval: live ? 10000 : false,
    placeholderData: keepPreviousData,
  });

  const logs = data?.data ?? [];
  const nextCursor = data?.nextCursor;
  const displayLogs = cursor ? [...allLogs, ...logs] : logs;

  const services = useMemo(
    () => Array.from(new Set(displayLogs.map((log) => log.service).filter(Boolean))).sort(),
    [displayLogs],
  );

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    displayLogs.forEach((log) => { counts[log.level] = (counts[log.level] ?? 0) + 1; });
    return counts;
  }, [displayLogs]);

  const reset = () => {
    setSearch('');
    setLevelFilter('all');
    setServiceFilter('all');
    setCursor(undefined);
    setAllLogs([]);
  };
  const filterSearch = (value: string) => { setSearch(value); setCursor(undefined); setAllLogs([]); };
  const filterLevel = (value: string) => { setLevelFilter(value); setCursor(undefined); setAllLogs([]); };
  const filterService = (value: string) => { setServiceFilter(value); setCursor(undefined); setAllLogs([]); };

  function exportLogs() {
    const payload = displayLogs.map((log) => ({
      ...log,
      attributes: parseAttributes(log.attributes),
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'soonwhy-logs.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!projectId) return <EmptyProject />;

  if (isError && !displayLogs.length) return <QueryErrorState onRetry={() => void refetch()} />;

  return (
    <div className="min-h-full space-y-5 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#16931F]">Telemetry explorer</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Logs</h1>
        {(traceIdFilter || spanIdFilter) && <p className="mt-1 text-xs text-[#16931F]">Showing correlated telemetry{spanIdFilter ? ' for span ' + spanIdFilter : ''}{traceIdFilter ? ' in trace ' + traceIdFilter : ''}</p>}
        <p className="mt-1 text-sm text-muted-foreground">Search every field, narrow the stream, and inspect the context around a log event.</p></div><div className="flex flex-wrap items-center gap-2"><TimeRangeControl value={range} onChange={(value) => { setRange(value); setCursor(undefined); setAllLogs([]); }} /><Button variant={live ? "default" : "outline"} size="sm" onClick={() => setLive((value) => !value)}>{live ? "Live" : "Live mode"}</Button></div>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search logs" placeholder="Search message, service, or attributes" value={search} onChange={(e) => filterSearch(e.target.value)} className="h-10 border-border bg-muted pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={levelFilter} onValueChange={filterLevel}>
                <SelectTrigger className="w-36"><SlidersHorizontal className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                  <SelectItem value="warn">Warnings</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
              <Select value={serviceFilter} onValueChange={filterService}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All services" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All services</SelectItem>
                  {services.map((service) => <SelectItem key={service} value={service}>{service}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={reset} className="border-border"><RotateCcw className="mr-2 h-3.5 w-3.5" />Reset</Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            {['error', 'warn', 'info', 'debug'].map((level) => (
              <button key={level} type="button" onClick={() => filterLevel(level)} className="rounded-lg border border-border bg-muted p-3 text-left hover:bg-secondary">
                <p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{level}</p>
                <p className="mt-1 text-lg font-semibold">{(levelCounts[level] ?? 0).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border bg-card shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted px-4 py-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{displayLogs.length.toLocaleString()} loaded events</p>
            <p className="text-[10px] text-muted-foreground">Current result set · filters apply to the query</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportLogs} disabled={!displayLogs.length}><Download className="mr-2 h-3.5 w-3.5" />Export</Button>
            <Button variant="outline" size="sm" disabled><Bookmark className="mr-2 h-3.5 w-3.5" />Save view</Button>
            {isFetching && !isLoading && <span className="self-center text-xs text-[#16931F]">Updating…</span>}
          </div>
        </div>
        <CardContent className="p-0">
          {isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div> : !displayLogs.length ? (
            <div className="p-12 text-center">
              <p className="font-medium">{search || levelFilter !== 'all' || serviceFilter !== 'all' ? 'No logs match this query' : 'No telemetry logs yet'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{search || levelFilter !== 'all' || serviceFilter !== 'all' ? 'Try a broader search or remove one of the filters.' : 'Send application telemetry to this project to start exploring logs.'}</p>
              {!search && levelFilter === 'all' && serviceFilter === 'all' && <Link to="/onboarding" className="mt-4 inline-flex text-sm font-medium text-[#16931F] hover:underline">Open setup flow</Link>}
            </div>
          ) : (
            <div className="max-h-[680px] overflow-auto">
              {displayLogs.map((log) => <LogRow key={log.id} log={log} />)}
              {nextCursor && <div className="border-t border-border p-3 text-center"><Button variant="outline" onClick={() => { setAllLogs(displayLogs); setCursor(nextCursor); }} disabled={isFetching}>{isFetching ? 'Loading…' : 'Load more events'}</Button></div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StaleNotice({ onRetry }: { onRetry: () => void }) { return <div className="flex items-center justify-between gap-3 rounded-xl border border-[#5A4A1C] bg-[#2A220F] px-4 py-3 text-xs text-[#D8C68A]"><span>Live telemetry is temporarily unavailable. Showing the last successful result.</span><Button variant="outline" size="sm" onClick={onRetry}>Retry</Button></div>; }\n\nfunction EmptyProject() {
  return <Card><CardContent className="p-10 text-center"><p className="font-medium">Choose a project</p><p className="mt-1 text-sm text-muted-foreground">Select a project from the top bar to inspect logs.</p></CardContent></Card>;
}
