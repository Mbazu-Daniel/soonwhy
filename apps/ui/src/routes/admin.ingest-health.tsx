import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Activity, TrendingUp, AlertTriangle, Clock, Database } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';

export const Route = createFileRoute('/admin/ingest-health')({
  component: IngestHealthPage,
});

interface IngestStats {
  accepted: number;
  rejected: number;
  published: number;
  inserted: number;
  dlq: number;
  errors: number;
  averageLatencyMs: number;
  eventsPerSecond: number;
  inFlight: number;
  peakInFlight: number;
}

function IngestHealthPage() {
  const stats = useQuery({
    queryKey: ['ingest-health-stats'],
    queryFn: () => api.get<IngestStats>('/admin/ingest-health/stats'),
    refetchInterval: 5000,
  });

  if (stats.isError) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="text-red-500">Failed to load ingest health stats</p>
          <Button onClick={() => void stats.refetch()} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = stats.data ?? {
    accepted: 0,
    rejected: 0,
    published: 0,
    inserted: 0,
    dlq: 0,
    errors: 0,
    averageLatencyMs: 0,
    eventsPerSecond: 0,
    inFlight: 0,
    peakInFlight: 0,
  };

  const successRate = data.accepted > 0 ? ((data.inserted / data.accepted) * 100).toFixed(1) : '0';
  const errorRate = data.accepted > 0 ? ((data.errors / data.accepted) * 100).toFixed(1) : '0';

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Ingestion Health</h1>
          <p className="text-xs text-[#989898]">Real-time telemetry ingestion metrics</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void stats.refetch()}
          disabled={stats.isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${stats.isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Throughput Metrics */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Events/sec</span>
              <Activity className="h-4 w-4 text-[#16931F]" />
            </div>
            <p className="mt-2 text-lg font-semibold">{data.eventsPerSecond.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Accepted</span>
              <TrendingUp className="h-4 w-4 text-[#16931F]" />
            </div>
            <p className="mt-2 text-lg font-semibold">{data.accepted.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Inserted</span>
              <Database className="h-4 w-4 text-[#16931F]" />
            </div>
            <p className="mt-2 text-lg font-semibold">{data.inserted.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Success Rate</span>
              <Activity className="h-4 w-4 text-[#16931F]" />
            </div>
            <p className="mt-2 text-lg font-semibold">{successRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Error Metrics */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Rejected</span>
              <AlertTriangle className="h-4 w-4 text-[#F2C66D]" />
            </div>
            <p className="mt-2 text-lg font-semibold">{data.rejected.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">DLQ</span>
              <AlertTriangle className="h-4 w-4 text-[#F2555A]" />
            </div>
            <p className="mt-2 text-lg font-semibold text-[#F2555A]">{data.dlq.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Errors</span>
              <AlertTriangle className="h-4 w-4 text-[#F2555A]" />
            </div>
            <p className="mt-2 text-lg font-semibold text-[#F2555A]">{data.errors.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Error Rate</span>
              <AlertTriangle className="h-4 w-4 text-[#F2555A]" />
            </div>
            <p className="mt-2 text-lg font-semibold text-[#F2555A]">{errorRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Avg Latency</span>
              <Clock className="h-4 w-4 text-[#16931F]" />
            </div>
            <p className="mt-2 text-lg font-semibold">{data.averageLatencyMs.toFixed(1)}ms</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">In Flight</span>
              <Activity className="h-4 w-4 text-[#16931F]" />
            </div>
            <p className="mt-2 text-lg font-semibold">{data.inFlight}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Peak In Flight</span>
              <TrendingUp className="h-4 w-4 text-[#16931F]" />
            </div>
            <p className="mt-2 text-lg font-semibold">{data.peakInFlight}</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Indicators */}
      <Card className="shadow-none">
        <CardContent className="p-6">
          <h3 className="text-sm font-medium mb-4">Ingestion Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Overall Health</span>
              <span className={`text-sm font-medium ${
                data.dlq === 0 && data.errors === 0 ? 'text-[#16931F]' : 
                data.dlq > 0 || data.errors > 10 ? 'text-[#F2555A]' : 
                'text-[#F2C66D]'
              }`}>
                {data.dlq === 0 && data.errors === 0 ? 'Healthy' : 
                 data.dlq > 0 || data.errors > 10 ? 'Degraded' : 
                 'Warning'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">DLQ Status</span>
              <span className={`text-sm font-medium ${data.dlq === 0 ? 'text-[#16931F]' : 'text-[#F2555A]'}`}>
                {data.dlq === 0 ? 'Clear' : `${data.dlq} entries`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Error Status</span>
              <span className={`text-sm font-medium ${data.errors === 0 ? 'text-[#16931F]' : 'text-[#F2555A]'}`}>
                {data.errors === 0 ? 'None' : `${data.errors} errors`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Throughput Status</span>
              <span className={`text-sm font-medium ${data.eventsPerSecond > 0 ? 'text-[#16931F]' : 'text-[#F2C66D]'}`}>
                {data.eventsPerSecond > 0 ? 'Active' : 'Idle'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
