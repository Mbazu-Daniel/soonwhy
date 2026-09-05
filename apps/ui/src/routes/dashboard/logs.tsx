import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '~/components/ui/select';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/dashboard/logs')({
  component: LogViewer,
});

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  message: string;
  attributes: string | Record<string, unknown>;
}

const LEVEL_COLORS: Record<string, string> = {
  info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  warn: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
  debug: 'bg-muted text-muted-foreground border-border',
};

function LogRow({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  let fields: Record<string, unknown> = {};
  if (typeof log.attributes === 'string') {
    try { fields = JSON.parse(log.attributes); } catch { fields = {}; }
  } else if (log.attributes && typeof log.attributes === 'object') {
    fields = log.attributes as Record<string, unknown>;
  }

  return (
    <div className="border-b last:border-b-0">
      <button
        className="w-full text-left px-4 py-2 hover:bg-muted/50 transition-colors flex items-center gap-3 text-sm"
        onClick={() => Object.keys(fields).length > 0 && setExpanded(!expanded)}
      >
        {Object.keys(fields).length > 0 ? (
          expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : <span className="w-3 shrink-0" />}
        <span className="text-muted-foreground font-mono text-xs w-44 shrink-0">{new Date(log.timestamp).toLocaleString()}</span>
        <Badge variant="outline" className={`${LEVEL_COLORS[log.level] ?? ''} text-xs w-14 justify-center shrink-0`}>{log.level}</Badge>
        <span className="text-muted-foreground text-xs w-36 truncate shrink-0">{log.service}</span>
        <span className="truncate flex-1">{log.message}</span>
      </button>
      {expanded && Object.keys(fields).length > 0 && (
        <div className="px-12 pb-2">
          <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto">{JSON.stringify(fields, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function LogViewer() {
  const { projectId } = useProject();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);

  const queryKey = ['logs', projectId, levelFilter, search, cursor] as const;

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ projectId: projectId! });
      if (levelFilter !== 'all') params.set('level', levelFilter);
      if (search) params.set('q', search);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '50');
      return api.get<{ data: LogEntry[]; nextCursor?: string }>(`/logs?${params.toString()}`);
    },
    enabled: !!projectId,
  });

  const logs = data?.data ?? [];
  const nextCursor = data?.nextCursor;

  // Reset cursor when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCursor(undefined);
    setAllLogs([]);
  };
  const handleLevelChange = (value: string) => {
    setLevelFilter(value);
    setCursor(undefined);
    setAllLogs([]);
  };

  // Accumulate logs for pagination
  const displayLogs = cursor ? [...allLogs, ...logs] : logs;
  const handleLoadMore = () => {
    if (nextCursor) {
      setAllLogs(displayLogs);
      setCursor(nextCursor);
    }
  };

  if (!projectId) {
    return <div className="space-y-6"><h2 className="text-2xl font-bold">Logs</h2><Card><CardContent className="p-8 text-center text-muted-foreground">Select a project</CardContent></Card></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Logs</h2>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search logs..." value={search} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9" />
            </div>
            <Select value={levelFilter} onValueChange={handleLevelChange}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => { handleSearchChange(''); handleLevelChange('all'); }}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">{displayLogs.length} log entries {isFetching && !isLoading ? '(loading...)' : ''}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : displayLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No logs found</div>
          ) : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {displayLogs.map((log) => <LogRow key={log.id} log={log} />)}
              {nextCursor && (
                <div className="p-3 text-center">
                  <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={isFetching}>
                    {isFetching ? 'Loading...' : 'Load more'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
