import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Activity, TrendingUp, Clock } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';

interface SyntheticProbeResult {
  id: number;
  probeId: number;
  status: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

interface ProbeResultsPanelProps {
  projectId: string;
  probeId: number;
}

export function ProbeResultsPanel({ projectId, probeId }: ProbeResultsPanelProps) {
  const [limit, setLimit] = useState(50);
  
  const results = useQuery({
    queryKey: ['synthetic-probe-results', probeId, limit],
    queryFn: () =>
      api.get<SyntheticProbeResult[]>(
        `/projects/${projectId}/synthetic-probes/${probeId}/results?limit=${limit}`,
      ),
    enabled: !!probeId,
  });

  if (results.isError) return <QueryErrorState onRetry={() => void results.refetch()} />;

  const items = results.data ?? [];
  const avgResponseTime = items.filter((r) => r.responseTimeMs).length
    ? Math.round(items.filter((r) => r.responseTimeMs).reduce((sum, r) => sum + (r.responseTimeMs || 0), 0) / items.filter((r) => r.responseTimeMs).length)
    : 0;
  const upCount = items.filter((r) => r.status === 'up').length;
  const uptimePercent = items.length ? Math.round((upCount / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Average response time</span>
              <Activity className="h-4 w-4 text-[#16931F]" />
            </div>
            <p className="mt-2 text-lg font-semibold">{avgResponseTime}ms</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Uptime</span>
              <TrendingUp className="h-4 w-4 text-[#16931F]" />
            </div>
            <p className="mt-2 text-lg font-semibold">{uptimePercent}%</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total checks</span>
              <Clock className="h-4 w-4 text-[#16931F]" />
            </div>
            <p className="mt-2 text-lg font-semibold">{items.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card shadow-none">
        <CardContent className="p-5">
          <div className="mb-4">
            <p className="text-sm font-medium">Response time history</p>
            <p className="text-xs text-muted-foreground">Last {limit} probe executions</p>
          </div>
          {results.isLoading ? (
            <div className="h-32 flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              <p>No probe results yet</p>
            </div>
          ) : (
            <div className="h-32 flex items-end gap-1">
              {items.slice().reverse().map((result, i) => {
                const height = result.responseTimeMs ? Math.min(100, (result.responseTimeMs / 5000) * 100) : 0;
                const color = result.status === 'up' ? 'bg-[#16931F]/70' : result.status === 'down' ? 'bg-[#F2555A]/70' : 'bg-[#F2C66D]/70';
                return (
                  <div
                    key={result.id}
                    className="flex-1 rounded-t transition-colors hover:opacity-80"
                    style={{ height: `${Math.max(4, height)}%` }}
                    className={color}
                    title={`${new Date(result.checkedAt).toLocaleString()}: ${result.responseTimeMs}ms - ${result.status}`}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-none">
        <CardContent className="p-5">
          <div className="mb-4">
            <p className="text-sm font-medium">Recent results</p>
          </div>
          {results.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              <p>No probe results yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.slice(0, 10).map((result) => (
                <div key={result.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${
                      result.status === 'up' ? 'bg-[#16931F]' : 
                      result.status === 'down' ? 'bg-[#F2555A]' : 
                      'bg-[#F2C66D]'
                    }`} />
                    <div>
                      <p className="text-sm font-medium">{result.status.toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">{new Date(result.checkedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{result.responseTimeMs ? `${result.responseTimeMs}ms` : '—'}</p>
                    <p className="text-xs text-muted-foreground">{result.statusCode || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
