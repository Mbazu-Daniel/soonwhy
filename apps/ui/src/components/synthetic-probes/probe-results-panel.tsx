import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Activity, TrendingUp, Clock, Calendar } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

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
  const [limit, setLimit] = useState(100);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

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

  const chartData = items.slice().reverse().map((result) => ({
    time: new Date(result.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timestamp: new Date(result.checkedAt).getTime(),
    responseTime: result.responseTimeMs || 0,
    status: result.status,
  }));

  const incidents: { start: string; end: string; duration: number }[] = [];
  let currentIncident: { start: string; end: string } | null = null;

  items.slice().reverse().forEach((result) => {
    if (!result.checkedAt) return;
    
    const checkedAtStr = new Date(result.checkedAt).toISOString();
    
    if (result.status === 'down' || result.status === 'degraded') {
      if (!currentIncident) {
        currentIncident = { start: checkedAtStr, end: checkedAtStr };
      } else {
        currentIncident.end = checkedAtStr;
      }
    } else {
      if (currentIncident) {
        const start = new Date(currentIncident.start).getTime();
        const end = new Date(currentIncident.end).getTime();
        incidents.push({
          start: currentIncident.start,
          end: currentIncident.end,
          duration: Math.round((end - start) / 1000 / 60),
        });
        currentIncident = null;
      }
    }
  });

  if (currentIncident) {
    const start = new Date((currentIncident as any).start).getTime();
    const end = new Date((currentIncident as any).end).getTime();
    incidents.push({
      start: (currentIncident as any).start,
      end: (currentIncident as any).end,
      duration: Math.round((end - start) / 1000 / 60),
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
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
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Incidents</span>
              <Calendar className="h-4 w-4 text-[#F2555A]" />
            </div>
            <p className="mt-2 text-lg font-semibold">{incidents.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Response time over time</p>
              <p className="text-xs text-muted-foreground">Last {limit} probe executions</p>
            </div>
            <div className="flex gap-2">
              {(['1h', '24h', '7d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-xs rounded ${
                    timeRange === range
                      ? 'bg-[#16931F] text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          {results.isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <p>No probe results yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="time"
                  stroke="#666"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#666"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'ms', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                  }}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: '#999' }}
                  formatter={(value, name) => {
                    if (name === 'responseTime' && value != null) return [`${value}ms`, 'Response Time'];
                    return [value ?? '', name ?? ''];
                  }}
                />
                <ReferenceLine y={1000} stroke="#F2C66D" strokeDasharray="3 3" label="1s" />
                <ReferenceLine y={5000} stroke="#F2555A" strokeDasharray="3 3" label="5s" />
                <Line
                  type="monotone"
                  dataKey="responseTime"
                  stroke="#16931F"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#16931F' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {incidents.length > 0 && (
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="mb-4">
              <p className="text-sm font-medium">Incident timeline</p>
              <p className="text-xs text-muted-foreground">Downtime and degraded periods</p>
            </div>
            <div className="space-y-2">
              {incidents.map((incident, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-[#F2555A]/30 bg-[#F2555A]/5 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-[#F2555A]" />
                    <div>
                      <p className="text-sm font-medium text-[#F2555A]">Downtime</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(incident.start).toLocaleString()} - {new Date(incident.end).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{incident.duration} min</p>
                    <p className="text-xs text-muted-foreground">duration</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
