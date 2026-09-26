import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronDown, ChevronRight, SlidersHorizontal, RotateCcw, Share2, Download, Bookmark, Copy, Clock3 } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/logs')({ component: LogViewer });
interface LogEntry { id: string; timestamp: string; level: string; service: string; message: string; attributes: string | Record<string, unknown>; }
interface HistogramBucket { key?: string; key_as_string?: string; doc_count?: number; }
interface HistogramResponse { timeline?: { buckets?: HistogramBucket[] }; levels?: { buckets?: Array<{ key: string; doc_count: number }> }; services?: { buckets?: Array<{ key: string; doc_count: number }> }; }
const RANGE_MS: Record<string, number> = { '15m': 15 * 60_000, '1h': 60 * 60_000, '6h': 6 * 60 * 60_000, '24h': 24 * 60 * 60_000, '7d': 7 * 24 * 60 * 60_000 };
const LEVEL_TREATMENT: Record<string, string> = { info: 'bg-secondary text-[#182012] border-[#C9E7EB]', warn: 'bg-[#FEF3C7] text-[#713F12] border-[#FDE68A]', error: 'bg-[#FDE8E6] text-[#8A1C13] border-[#F8C7C2]', fatal: 'bg-[#FDE8E6] text-[#8A1C13] border-[#F8C7C2]', debug: 'bg-secondary text-[#4D5A4A] border-[#242426]' };

function parseAttributes(attributes: LogEntry['attributes']) {
  if (typeof attributes === 'string') { try { return JSON.parse(attributes) as Record<string, unknown>; } catch { return {}; } }
  return attributes ?? {};
}
function LogRow({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const fields = parseAttributes(log.attributes);
  const expandable = Object.keys(fields).length > 0;
  return <article className="border-b border-[#242426] last:border-0"><button type="button" aria-expanded={expandable ? expanded : undefined} onClick={() => expandable && setExpanded(!expanded)} className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-[#151517] focus-visible:bg-[#151517] sm:items-center">
    <span className="grid h-5 w-5 shrink-0 place-items-center">{expandable ? (expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : null}</span>
    <time className="w-auto shrink-0 font-mono text-[11px] text-[#989898] sm:w-40">{new Date(log.timestamp).toLocaleString()}</time>
    <Badge variant="outline" className={`w-14 shrink-0 justify-center text-[10px] uppercase ${LEVEL_TREATMENT[log.level] ?? LEVEL_TREATMENT.debug}`}>{log.level}</Badge>
    <span className="hidden w-32 shrink-0 truncate text-xs font-medium text-[#ACFC15] sm:block">{log.service}</span><span className="min-w-0 flex-1 truncate">{log.message}</span>
  </button>{expanded && <div className="bg-[#151517] px-12 pb-4"><pre className="overflow-x-auto rounded-lg border border-[#242426] bg-[#0B0B0C] p-4 text-xs leading-5">{JSON.stringify(fields, null, 2)}</pre></div>}</article>;
}
function LogViewer() {
  const { projectId } = useProject();
  const [search, setSearch] = useState(''); const [levelFilter, setLevelFilter] = useState('all'); const [serviceFilter, setServiceFilter] = useState('all'); const [range, setRange] = useState('24h');
  const [cursor, setCursor] = useState<string>(); const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const from = new Date(Date.now() - RANGE_MS[range]).toISOString(); const to = new Date().toISOString();
  const baseParams = new URLSearchParams({ projectId: projectId ?? '', from, to });
  if (levelFilter !== 'all') baseParams.set('level', levelFilter); if (serviceFilter !== 'all') baseParams.set('service', serviceFilter); if (search.trim()) baseParams.set('q', search.trim());
  const query = baseParams.toString();
  const { data, isLoading, isFetching, isError, refetch } = useQuery({ queryKey: ['logs', projectId, range, levelFilter, serviceFilter, search, cursor], queryFn: () => api.get<{ data: LogEntry[]; nextCursor?: string }>(`/logs?${query}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}&limit=50`), enabled: !!projectId });
  const histogram = useQuery({ queryKey: ['logs-histogram', projectId, range, levelFilter, serviceFilter, search], queryFn: () => api.get<HistogramResponse>(`/logs/histogram?${query}`), enabled: !!projectId });
  const logs = data?.data ?? []; const displayLogs = cursor ? [...allLogs, ...logs] : logs;
  const serviceOptions = histogram.data?.services?.buckets?.map((item) => item.key) ?? [];
  const buckets = histogram.data?.timeline?.buckets ?? []; const maxBucket = Math.max(1, ...buckets.map((bucket) => bucket.doc_count ?? 0));
  const reset = () => { setSearch(''); setLevelFilter('all'); setServiceFilter('all'); setRange('24h'); setCursor(undefined); setAllLogs([]); };
  const filter = (setter: (value: string) => void, value: string) => { setter(value); setCursor(undefined); setAllLogs([]); };
  const saveView = () => { const name = window.prompt('Name this saved search'); if (!name?.trim()) return; const key = 'soonwhy:saved-log-views'; const current = JSON.parse(localStorage.getItem(key) ?? '[]') as string[]; localStorage.setItem(key, JSON.stringify([...new Set([...current, name.trim()])])); };
  const copyLink = () => void navigator.clipboard?.writeText(window.location.href);
  const exportCsv = () => { const csv = [['timestamp','level','service','message'], ...displayLogs.map((log) => [log.timestamp, log.level, log.service, log.message])].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = 'soonwhy-logs.csv'; a.click(); URL.revokeObjectURL(url); };
  if (!projectId) return <EmptyProject />; if (isError) return <QueryErrorState onRetry={() => void refetch()} />;
  return <div className="mx-auto w-full space-y-4 pb-10">
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#ACFC15]">Telemetry explorer</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Logs</h1><p className="mt-1 text-sm text-[#989898]">Search, filter, correlate and export the evidence behind an investigation.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={copyLink}><Share2 className="mr-2 h-3.5 w-3.5" />Share</Button><Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-3.5 w-3.5" />Export</Button></div></header>
    <Card className="overflow-hidden border-[#242426] bg-[#0B0B0C] shadow-none"><CardContent className="p-3"><div className="flex flex-col gap-2 xl:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#989898]" /><Input aria-label="Search logs" placeholder="Search message, service, or attributes" value={search} onChange={(e) => filter(setSearch, e.target.value)} className="h-10 border-[#242426] bg-[#151517] pl-9" /></div>
      <Select value={range} onValueChange={(v) => filter(setRange, v)}><SelectTrigger className="h-10 w-32"><Clock3 className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger><SelectContent>{Object.keys(RANGE_MS).map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      <Select value={levelFilter} onValueChange={(v) => filter(setLevelFilter, v)}><SelectTrigger className="h-10 w-36"><SlidersHorizontal className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All levels</SelectItem><SelectItem value="error">Errors</SelectItem><SelectItem value="fatal">Fatal</SelectItem><SelectItem value="warn">Warnings</SelectItem><SelectItem value="info">Info</SelectItem><SelectItem value="debug">Debug</SelectItem></SelectContent></Select>
      <Select value={serviceFilter} onValueChange={(v) => filter(setServiceFilter, v)}><SelectTrigger className="h-10 w-40"><SelectValue placeholder="Service" /></SelectTrigger><SelectContent><SelectItem value="all">All services</SelectItem>{serviceOptions.map((service) => <SelectItem key={service} value={service}>{service}</SelectItem>)}</SelectContent></Select>
      <Button variant="outline" size="icon" onClick={reset} aria-label="Reset search"><RotateCcw className="h-4 w-4" /></Button></div>
      <div className="mt-3 flex items-center justify-between border-t border-[#1B1B1D] pt-3 text-xs text-[#6E6E70]"><span>{displayLogs.length.toLocaleString()} loaded events</span><div className="flex items-center gap-1"><Button variant="ghost" size="sm" onClick={saveView}><Bookmark className="mr-1.5 h-3.5 w-3.5" />Save view</Button><Button variant="ghost" size="sm" onClick={copyLink}><Copy className="mr-1.5 h-3.5 w-3.5" />Copy link</Button></div></div>
    </CardContent></Card>
    <Card className="border-[#242426] bg-[#0B0B0C] shadow-none"><CardContent className="p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-medium text-[#989898]">Log frequency</p><p className="mt-1 text-[10px] text-[#6E6E70]">Hourly volume over {range}</p></div><span className="text-xs text-[#6E6E70]">{histogram.isFetching ? 'Updating…' : 'Live query'}</span></div><div className="flex h-28 items-end gap-1">{buckets.map((bucket, index) => <div key={index} className="group flex h-full flex-1 items-end" title={`${bucket.doc_count ?? 0} events`}><div className="w-full rounded-t bg-[#415312] group-hover:bg-[#ACFC15]" style={{ height: `${Math.max(3, ((bucket.doc_count ?? 0) / maxBucket) * 100)}%` }} /></div>)}</div>{!buckets.length && <p className="py-8 text-center text-xs text-[#6E6E70]">No histogram data for this search.</p>}<div className="mt-4 flex flex-wrap gap-4 border-t border-[#1B1B1D] pt-3 text-[11px] text-[#989898]">{histogram.data?.levels?.buckets?.map((item) => <span key={item.key}>{item.key}: <strong className="text-[#F6F6F6]">{item.doc_count.toLocaleString()}</strong></span>)}</div></CardContent></Card>
    <Card className="overflow-hidden border-[#242426] bg-[#0B0B0C] shadow-none"><div className="flex items-center justify-between border-b border-[#242426] bg-[#151517] px-4 py-3"><p className="text-xs font-medium text-[#989898]">{displayLogs.length.toLocaleString()} loaded events</p>{isFetching && !isLoading && <span className="text-xs text-[#ACFC15]">Updating…</span>}</div><CardContent className="p-0">{isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div> : !displayLogs.length ? <div className="p-12 text-center"><p className="font-medium">{search || levelFilter !== 'all' || serviceFilter !== 'all' ? 'No logs match this query' : 'No telemetry logs yet'}</p><p className="mt-1 text-sm text-[#989898]">Try widening the time range or removing a filter.</p>{!search && levelFilter === 'all' && serviceFilter === 'all' && <Link to="/onboarding" className="mt-4 inline-flex text-sm font-medium text-[#ACFC15] hover:underline">Open setup flow</Link>}</div> : <div className="max-h-[640px] overflow-auto">{displayLogs.map((log) => <LogRow key={log.id} log={log} />)}{data?.nextCursor && <div className="border-t border-[#242426] p-3 text-center"><Button variant="outline" onClick={() => { setAllLogs(displayLogs); setCursor(data.nextCursor); }} disabled={isFetching}>{isFetching ? 'Loading…' : 'Load more events'}</Button></div>}</div>}</CardContent></Card>
  </div>;
}
function EmptyProject() { return <Card><CardContent className="p-10 text-center"><p className="font-medium">Choose a project</p><p className="mt-1 text-sm text-[#989898]">Select a project from the sidebar to inspect logs.</p></CardContent></Card>; }
