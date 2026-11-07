import { QueryErrorState } from '~/components/query-error-state';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { telemetryRangeParams } from '~/components/telemetry/time-range-control';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '~/components/ui/select';
import { ChevronDown, ChevronRight, Download, RotateCcw } from 'lucide-react';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { Badge } from '~/components/ui/badge';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/logs')({ component: LogViewer });

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  message: string;
  method?: string;
  endpoint?: string;
  status?: number | string;
  duration?: number | string;
  attributes: string | Record<string, unknown>;
}

const LEVEL_TREATMENT: Record<string, string> = {
  info: 'bg-secondary text-[#182012] border-[#C9E7EB]',
  warn: 'bg-[#FEF3C7] text-[#713F12] border-[#FDE68A]',
  error: 'bg-[#FDE8E6] text-[#8A1C13] border-[#F8C7C2]',
  debug: 'bg-secondary text-[#4D5A4A] border-[#242426]',
};

const STATUS_TREATMENT: Record<string, string> = {
  '200': 'bg-[#0B0B0C] text-[#ACFC15] border-[#16931F]',
  '201': 'bg-[#0B0B0C] text-[#ACFC15] border-[#16931F]',
  '301': 'bg-[#0B0B0C] text-[#713F12] border-[#FDE68A]',
  '302': 'bg-[#0B0B0C] text-[#713F12] border-[#FDE68A]',
  '400': 'bg-[#FDE8E6] text-[#8A1C13] border-[#F8C7C2]',
  '401': 'bg-[#FDE8E6] text-[#8A1C13] border-[#F8C7C2]',
  '403': 'bg-[#FDE8E6] text-[#8A1C13] border-[#F8C7C2]',
  '404': 'bg-[#FDE8E6] text-[#8A1C13] border-[#F8C7C2]',
  '500': 'bg-[#FDE8E6] text-[#8A1C13] border-[#F8C7C2]',
  'default': 'bg-secondary text-[#4D5A4A] border-[#242426]',
};

function statusBadgeClass(status: number | string | undefined): string {
  if (!status) return STATUS_TREATMENT.default;
  return STATUS_TREATMENT[String(status)] ?? STATUS_TREATMENT.default;
}

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
  const statusClass = statusBadgeClass(log.status);

  return (
    <>
      <tr className="border-b border-[#242426] last:border-0 hover:bg-[#151517]/50 transition-colors">
        <td className="p-3 whitespace-nowrap text-left">
          <time className="font-mono text-[11px] text-[#989898]">
            {new Date(log.timestamp).toLocaleString()}
          </time>
        </td>
        <td className="p-3 whitespace-nowrap text-left">
          <Badge variant="outline" className={`w-20 shrink-0 text-[10px] uppercase ${LEVEL_TREATMENT[log.level] ?? LEVEL_TREATMENT.debug}`}>
            {log.level}
          </Badge>
        </td>
        <td className="p-3 whitespace-nowrap text-left truncate">
          <span className="w-32 shrink-0 text-xs font-medium text-[#ACFC15]">{log.service}</span>
        </td>
        <td className="p-3 whitespace-nowrap text-left truncate">
          <span className="text-xs font-mono text-[#6E6E70]">{log.method}</span>
        </td>
        <td className="p-3 whitespace-nowrap text-left truncate">
          <span className="text-xs font-mono text-[#6E6E70]">{log.endpoint}</span>
        </td>
        <td className="p-3 whitespace-nowrap text-left truncate">
          <Badge variant="outline" className={`w-16 shrink-0 text-[10px] uppercase ${statusClass}`}>
            {log.status ?? '-'}
          </Badge>
        </td>
        <td className="p-3 whitespace-nowrap text-left truncate">
          <span className="text-xs font-mono text-[#6E6E70]">{log.duration ?? '-'}</span>
        </td>
        <td className="p-3 text-right">
          {expandable ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
              className="h-3.5 w-3.5 shrink-0"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : null}
        </td>
      </tr>
      {expandable && (
        <tr className="border-b border-[#242426] last:border-0">
          <td colSpan={8} className="p-3 bg-[#151517]">
            <pre className="overflow-x-auto rounded border border-[#242426] bg-[#0B0B0C] p-3 text-xs leading-5">
              {JSON.stringify(fields, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

const RANGE_MS: Record<string, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
  '7d': 7 * 24 * 60 * 60_000,
};

function EmptyProject() {
  return (
    <div className="p-10 text-center text-muted-foreground">
      <p className="font-medium">Choose a project</p>
      <p className="mt-1 text-sm">
        Select a project from the top bar to inspect logs.
      </p>
    </div>
  );
}

function LogViewer() {
  const { projectId } = useProject();
  const [range, setRange] = useState('24h');
  const { from, to } = telemetryRangeParams(range as '1h' | '6h' | '24h' | '7d');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['logs', projectId, range],
    queryFn: () =>
      api.get<{ data: LogEntry[]; nextCursor?: string }>(`/projects/${projectId}/logs?from=${from}&to=${to}&interval=5m`),
    enabled: !!projectId,
    refetchInterval: 15_000,
  });

  if (!projectId) return <EmptyProject />;
  if (isError) return <QueryErrorState onRetry={() => void refetch()} />;

  const { data: logsData = [], } = data ?? {};

  const allLogs = useMemo(() => logsData || [], [logsData]);

  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const services = useMemo(
    () => Array.from(new Set((allLogs || []).map((log: any) => log.service).filter(Boolean))).sort(),
    [allLogs],
  );
  const serviceOptions = services;

  const initialService = useMemo(() => {
    return Array.from(new Set(allLogs.map((log) => log.service).filter(Boolean))).sort();
  }, [allLogs]);

  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      const matchesSearch =
        !search ||
        log.message.toLowerCase().includes(search.toLowerCase()) ||
        (log.service && log.service.toLowerCase().includes(search.toLowerCase()));
      const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
      const matchesService = serviceFilter === 'all' || log.service === serviceFilter;
      return matchesSearch && matchesLevel && matchesService;
    });
  }, [allLogs, search, levelFilter, serviceFilter]);

  const reset = () => {
    setSearch('');
    setLevelFilter('all');
    setServiceFilter('all');
  };

  const exportLogs = () => {
    alert('Export functionality can be implemented');
  };

  return (
    <div className="mx-auto w-full space-y-4">
      {/* Time range and live mode */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setRange('1h')} className={`px-2 ${range === '1h' ? 'bg-[#151517] text-[#ACFC15]' : 'text-[#989898]'}`}>1h</Button>
        <Button variant="outline" size="sm" onClick={() => setRange('6h')} className={`px-2 ${range === '6h' ? 'bg-[#151517] text-[#ACFC15]' : 'text-[#989898]'}`}>6h</Button>
        <Button variant="outline" size="sm" onClick={() => setRange('24h')} className={`px-2 ${range === '24h' ? 'bg-[#151517] text-[#ACFC15]' : 'text-[#989898]'}`}>24h</Button>
        <Button variant="outline" size="sm" onClick={() => setRange('7d')} className={`px-2 ${range === '7d' ? 'bg-[#151517] text-[#ACFC15]' : 'text-[#989898]'}`}>7d</Button>
        <Button variant="outline" size="sm" className="px-2">Live mode</Button>
        <Button variant="outline" size="sm" onClick={exportLogs} disabled={!filteredLogs.length} className="px-2">
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </div>

      {/* Search and filters in one line */}
      <div className="flex items-center border border-[#242426] rounded-lg bg-[#0B0B0C] overflow-hidden">
        <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
          <span className="text-xs text-[#989898] flex-shrink-0">🔍</span>
          <Input
            aria-label="Search logs"
            placeholder="Search message, service, or attributes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 border-none bg-transparent focus:ring-0 placeholder-[#6E6E70] px-0"
          />
        </div>
        <div className="h-9 w-px bg-[#242426]" />
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="h-9 w-[110px] border-none rounded-none bg-transparent text-xs">
            <SelectValue className="text-xs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
          </SelectContent>
        </Select>
        <div className="h-9 w-px bg-[#242426]" />
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="h-9 w-[140px] border-none rounded-none bg-transparent text-xs">
            <SelectValue className="text-xs" placeholder="All services" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            {serviceOptions.map((service: string) => (
              <SelectItem key={service} value={service}>{service}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="h-9 w-px bg-[#242426]" />
        <Button variant="ghost" size="icon" onClick={reset} className="h-9 w-9 rounded-none text-[#989898] hover:text-[#F6F6F6]">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-[#6E6E70]">
        <span>{filteredLogs.length.toLocaleString()} loaded events</span>
        <span>Current result set · filters apply to the query</span>
      </div>

      {/* Table */}
      <div className="border border-[#242426] rounded-lg bg-[#0B0B0C] overflow-hidden">
        <table className="w-full text-sm text-left text-[#F6F6F6] rtl:rtl-normal">
          <thead className="text-xs text-[#989898] border-b border-[#242426] bg-[#0B0B0C] sticky top-0 z-10">
            <tr className="h-10">
              <th className="p-3 text-left">TIME</th>
              <th className="p-3 text-left">LEVEL</th>
              <th className="p-3 text-left">SERVICE</th>
              <th className="p-3 text-left">METHOD</th>
              <th className="p-3 text-left">ENDPOINT</th>
              <th className="p-3 text-left">STATUS</th>
              <th className="p-3 text-left">DURATION</th>
              <th className="p-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#242426]">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => <LogRow key={log.id} log={log} />)
            ) : (
              <tr>
                <td colSpan={8} className="p-8 text-center text-[#6E6E70]">
                  No logs match this query. Try a broader search or remove one of the filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-[#6E6E70] whitespace-nowrap">
        {filteredLogs.length.toLocaleString()} loaded events · Current result set · filters apply to the query
      </div>
    </div>
  );
}
