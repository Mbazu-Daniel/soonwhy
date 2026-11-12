import { QueryErrorState } from '~/components/query-error-state';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { telemetryRangeParams, TELEMETRY_RANGES, type TelemetryRange } from '~/components/telemetry/time-range-control';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '~/components/ui/select';
import { ChevronDown, ChevronRight, Clock3, Search } from 'lucide-react';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { Badge } from '~/components/ui/badge';
import { EmptyProject } from '~/components/empty-state';

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

const REQUEST_LINE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)(?:\s+(\d{3}))?$/;

function parseRequestMessage(log: LogEntry) {
  if (log.method || log.endpoint) return null;
  const match = REQUEST_LINE.exec(log.message.trim());
  if (!match) return null;
  return { method: match[1], endpoint: match[2], status: match[3] };
}

function LogRow({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const fields = parseAttributes(log.attributes);
  const expandable = Object.keys(fields).length > 0;
  const request = parseRequestMessage(log);
  const method = log.method ?? request?.method;
  const endpoint = log.endpoint ?? request?.endpoint;
  const status = log.status ?? request?.status;
  const hasRequest = Boolean(method || endpoint || status || log.duration);

  return (
    <>
      <tr
        onClick={expandable ? () => setExpanded(!expanded) : undefined}
        className={`border-b border-[#242426] last:border-0 transition-colors ${expandable ? 'cursor-pointer hover:bg-[#151517]/50' : ''}`}
      >
        <td className="p-3 pr-2 w-6 text-center align-middle">
          {expandable ? (
            expanded ? <ChevronDown className="h-3.5 w-3.5 text-[#989898]" /> : <ChevronRight className="h-3.5 w-3.5 text-[#6E6E70]" />
          ) : null}
        </td>
        <td className="p-3 py-2 pl-0 whitespace-nowrap text-left">
          <time className="font-mono text-[11px] text-[#989898]">
            {new Date(log.timestamp).toLocaleTimeString()}
          </time>
        </td>
        <td className="p-3 py-2 whitespace-nowrap text-left">
          <Badge variant="outline" className={`w-16 shrink-0 justify-center text-[10px] uppercase ${LEVEL_TREATMENT[log.level] ?? LEVEL_TREATMENT.debug}`}>
            {log.level}
          </Badge>
        </td>
        <td className="p-3 py-2 whitespace-nowrap text-left">
          <span className="text-xs font-medium text-[#ACFC15]">{log.service}</span>
        </td>
        <td className="p-3 py-2 text-left min-w-0 max-w-0">
          {request ? (
            <span className="block truncate font-mono text-xs">
              <span className="text-[#ACFC15]">{request.method}</span>{' '}
              <span>{request.endpoint}</span>
              {request.status && <span className="text-[#989898]"> {request.status}</span>}
            </span>
          ) : (
            <span className="block truncate text-sm">{log.message}</span>
          )}
        </td>
        <td className="p-3 py-2 whitespace-nowrap text-right">
          {status ? (
            <Badge variant="outline" className={`w-12 shrink-0 justify-center text-[10px] ${statusBadgeClass(status)}`}>
              {status}
            </Badge>
          ) : log.duration ? (
            <span className="font-mono text-[11px] text-[#6E6E70]">{log.duration}ms</span>
          ) : null}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[#242426] last:border-0 bg-[#151517]">
          <td colSpan={6} className="p-3 pl-10">
            {hasRequest && (
              <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[#989898]">
                {method && <span>{method}</span>}
                {endpoint && <span>{endpoint}</span>}
                {status && <span>status {status}</span>}
                {log.duration && <span>{log.duration}ms</span>}
              </div>
            )}
            <pre className="overflow-x-auto rounded border border-[#242426] bg-[#0B0B0C] p-3 text-xs leading-5">
              {JSON.stringify(fields, null, 2)}
            </pre>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mt-2 text-xs text-[#989898] underline-offset-2 hover:text-[#F6F6F6] hover:underline"
            >
              Collapse
            </button>
          </td>
        </tr>
      )}
    </>
  );
}



type LogRange = TelemetryRange | 'custom' | 'all';

function LogViewer() {
  const { projectId } = useProject();
  const [range, setRange] = useState<LogRange>('24h');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { from, to } = (() => {
    if (range === 'all') return { from: new Date(0).toISOString(), to: new Date().toISOString() };
    if (range === 'custom') {
      const fallbackFrom = new Date(Date.now() - 60 * 60 * 1000);
      return {
        from: customFrom ? new Date(customFrom).toISOString() : fallbackFrom.toISOString(),
        to: customTo ? new Date(customTo).toISOString() : new Date().toISOString(),
      };
    }
    return telemetryRangeParams(range);
  })();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['logs', projectId, range, customFrom, customTo],
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

  return (
    <div className="mx-auto w-full space-y-4">
      {/* Toolbar: search on the left, time + filters + actions on the right */}
      <div className="flex items-center gap-2 border border-[#242426] rounded-lg bg-[#0B0B0C] px-2 py-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Search className="h-4 w-4 flex-shrink-0 text-[#989898]" />
          <Input
            aria-label="Search logs"
            placeholder="Search message, service, or attributes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 flex-1 border-none bg-transparent px-0 text-sm focus:ring-0 placeholder-[#6E6E70]"
          />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {range === 'custom' && (
            <>
              <Input
                aria-label="Custom start time"
                type="datetime-local"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 w-[180px] border-[#242426] bg-[#151517] px-2 text-xs"
              />
              <span className="text-xs text-[#6E6E70]">to</span>
              <Input
                aria-label="Custom end time"
                type="datetime-local"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 w-[180px] border-[#242426] bg-[#151517] px-2 text-xs"
              />
            </>
          )}
          <Select value={range} onValueChange={(v) => setRange(v as LogRange)}>
            <SelectTrigger className="h-9 w-[110px] rounded-md border-[#242426] bg-[#151517] px-2 text-xs text-[#ACFC15]">
              <Clock3 className="mr-1 h-3.5 w-3.5 text-[#989898]" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TELEMETRY_RANGES.map((item) => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
              <SelectItem value="custom">Custom</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <div className="mx-1 h-9 w-px bg-[#242426]" />
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="h-9 w-[110px] rounded-md border-[#242426] bg-[#151517] px-2 text-xs">
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
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="h-9 w-[140px] rounded-md border-[#242426] bg-[#151517] px-2 text-xs">
              <SelectValue className="text-xs" placeholder="All services" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {serviceOptions.map((service: string) => (
                <SelectItem key={service} value={service}>{service}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mx-1 h-9 w-px bg-[#242426]" />
          <Button variant="outline" size="sm" className="h-9 px-2 text-xs">Live mode</Button>
        </div>
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
              <th className="w-6 p-3"></th>
              <th className="p-3 pl-0 text-left">TIME</th>
              <th className="p-3 text-left">LEVEL</th>
              <th className="p-3 text-left">SERVICE</th>
              <th className="p-3 text-left">MESSAGE</th>
              <th className="p-3 text-right">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#242426]">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => <LogRow key={log.id} log={log} />)
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[#6E6E70]">
                  No logs match this query. Try a broader search or remove one of the filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
