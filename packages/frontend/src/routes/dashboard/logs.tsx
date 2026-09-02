import { useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';

export const Route = createFileRoute('/dashboard/logs')({
  component: LogViewer,
});

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  message: string;
  fields?: Record<string, unknown>;
  traceId?: string;
}

const MOCK_LOGS: LogEntry[] = [
  {
    id: '1',
    timestamp: '2026-09-02T14:23:45.123Z',
    level: 'info',
    service: 'api-gateway',
    message: 'Request completed',
    fields: { method: 'GET', path: '/api/users', status: 200, duration: 45 },
    traceId: 'abc-123-def-456',
  },
  {
    id: '2',
    timestamp: '2026-09-02T14:23:44.987Z',
    level: 'error',
    service: 'payment-service',
    message: 'Payment gateway timeout: 30s exceeded',
    fields: { provider: 'stripe', amount: 9900, currency: 'usd' },
    traceId: 'xyz-789-abc-123',
  },
  {
    id: '3',
    timestamp: '2026-09-02T14:23:43.456Z',
    level: 'warn',
    service: 'api-gateway',
    message: 'Rate limit approaching for client',
    fields: { clientId: 'client_abc', currentRate: 950, limit: 1000 },
  },
  {
    id: '4',
    timestamp: '2026-09-02T14:23:42.100Z',
    level: 'info',
    service: 'auth-service',
    message: 'User authenticated successfully',
    fields: { userId: 'usr_123', method: 'oauth2' },
    traceId: 'auth-456-def-789',
  },
  {
    id: '5',
    timestamp: '2026-09-02T14:23:41.000Z',
    level: 'debug',
    service: 'data-processor',
    message: 'Processing batch of events',
    fields: { batchSize: 100, queueDepth: 450 },
  },
  {
    id: '6',
    timestamp: '2026-09-02T14:23:40.500Z',
    level: 'info',
    service: 'notification-service',
    message: 'Email sent successfully',
    fields: { to: 'user@example.com', template: 'welcome' },
    traceId: 'notif-789-abc-012',
  },
  {
    id: '7',
    timestamp: '2026-09-02T14:23:39.200Z',
    level: 'error',
    service: 'data-processor',
    message: 'Failed to write to ClickHouse',
    fields: { table: 'logs', error: 'Connection refused', retries: 3 },
    traceId: 'proc-012-def-345',
  },
  {
    id: '8',
    timestamp: '2026-09-02T14:23:38.000Z',
    level: 'info',
    service: 'api-gateway',
    message: 'Health check passed',
    fields: { uptime: 864000 },
  },
];

const LEVEL_COLORS = {
  info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  warn: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
  debug: 'bg-muted text-muted-foreground border-border',
};

function LogRow({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasFields = log.fields && Object.keys(log.fields).length > 0;

  return (
    <div className="border-b last:border-b-0">
      <button
        className="w-full text-left px-4 py-2 hover:bg-muted/50 transition-colors flex items-center gap-3 text-sm"
        onClick={() => hasFields && setExpanded(!expanded)}
      >
        {hasFields ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="text-muted-foreground font-mono text-xs w-44 shrink-0">
          {new Date(log.timestamp).toLocaleString()}
        </span>
        <Badge variant="outline" className={`${LEVEL_COLORS[log.level]} text-xs w-14 justify-center shrink-0`}>
          {log.level}
        </Badge>
        <span className="text-muted-foreground text-xs w-36 truncate shrink-0">
          {log.service}
        </span>
        <span className="truncate flex-1">{log.message}</span>
        {log.traceId && (
          <span className="text-xs text-muted-foreground font-mono shrink-0">
            {log.traceId.slice(0, 12)}
          </span>
        )}
      </button>
      {expanded && log.fields && (
        <div className="px-12 pb-2">
          <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto">
            {JSON.stringify(log.fields, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function LogViewer() {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  const filteredLogs = useMemo(() => {
    return MOCK_LOGS.filter((log) => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (serviceFilter !== 'all' && log.service !== serviceFilter) return false;
      if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, levelFilter, serviceFilter]);

  const services = [...new Set(MOCK_LOGS.map((l) => l.service))].sort();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Logs</h2>
        <p className="text-muted-foreground">Search and filter application logs</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(''); setLevelFilter('all'); setServiceFilter('all'); }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            {filteredLogs.length} log entries
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No logs match your filters
            </div>
          ) : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {filteredLogs.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
