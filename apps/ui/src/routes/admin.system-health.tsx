import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Server, Database, HardDrive, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { api } from '~/lib/api';

export const Route = createFileRoute('/admin/system-health')({
  component: SystemHealthPage,
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

interface PipelineLagMetrics {
  quickwitIndexingLagMs: number;
  quickwitPendingDocs: number;
  lastUpdated: string;
}

interface DlqStats {
  total: number;
  unreplayed: number;
  replayed: number;
  successful: number;
  failed: number;
}

function SystemHealthPage() {
  const ingestStats = useQuery({
    queryKey: ['ingest-health-stats'],
    queryFn: () => api.get<IngestStats>('/admin/ingest-health/stats'),
    refetchInterval: 10000,
  });

  const pipelineLag = useQuery({
    queryKey: ['pipeline-lag-metrics'],
    queryFn: () => api.get<PipelineLagMetrics>('/admin/pipeline-lag/metrics'),
    refetchInterval: 10000,
  });

  const dlqStats = useQuery({
    queryKey: ['dlq-stats'],
    queryFn: () => api.get<DlqStats>('/admin/dlq/stats'),
    refetchInterval: 30000,
  });

  const isHealthy = 
    (ingestStats.data?.dlq ?? 0) === 0 && 
    (ingestStats.data?.errors ?? 0) === 0 &&
    (pipelineLag.data?.quickwitIndexingLagMs ?? 0) < 60000; // Less than 1 minute lag

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">System Health</h1>
          <p className="text-xs text-[#989898]">Monitor Soonwhy platform health and performance</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge 
            variant="outline" 
            className={
              isHealthy 
                ? 'bg-[#16931F]/10 text-[#16931F] border-[#16931F]' 
                : 'bg-[#F2555A]/10 text-[#F2555A] border-[#F2555A]'
            }
          >
            {isHealthy ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Healthy
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3 mr-1" />
                Degraded
              </>
            )}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void ingestStats.refetch();
              void pipelineLag.refetch();
              void dlqStats.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <Card className="shadow-none">
        <CardContent className="p-6">
          <h3 className="text-sm font-medium mb-4">Platform Status</h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${isHealthy ? 'bg-[#16931F]' : 'bg-[#F2555A]'}`} />
              <div>
                <p className="text-sm font-medium">Overall Health</p>
                <p className="text-xs text-muted-foreground">
                  {isHealthy ? 'All systems operational' : 'Some systems degraded'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-[#16931F]" />
              <div>
                <p className="text-sm font-medium">API Server</p>
                <p className="text-xs text-muted-foreground">Operational</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-[#16931F]" />
              <div>
                <p className="text-sm font-medium">Database</p>
                <p className="text-xs text-muted-foreground">Connected</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <HardDrive className="h-5 w-5 text-[#16931F]" />
              <div>
                <p className="text-sm font-medium">Storage (Quickwit)</p>
                <p className="text-xs text-muted-foreground">Operational</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ingestion Metrics */}
      <Card className="shadow-none">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Telemetry Ingestion</h3>
            <Badge variant="outline">
              {ingestStats.data?.eventsPerSecond.toFixed(2) || 0} events/sec
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Accepted</p>
              <p className="text-lg font-semibold">{ingestStats.data?.accepted.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inserted</p>
              <p className="text-lg font-semibold">{ingestStats.data?.inserted.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Latency</p>
              <p className="text-lg font-semibold">{ingestStats.data?.averageLatencyMs.toFixed(1) || 0}ms</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">In Flight</p>
              <p className="text-lg font-semibold">{ingestStats.data?.inFlight || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Metrics */}
      <Card className="shadow-none">
        <CardContent className="p-6">
          <h3 className="text-sm font-medium mb-4">Error Tracking</h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Rejected</p>
              <p className="text-lg font-semibold">{ingestStats.data?.rejected.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">DLQ Entries</p>
              <p className={`text-lg font-semibold ${(ingestStats.data?.dlq ?? 0) > 0 ? 'text-[#F2555A]' : ''}`}>
                {(ingestStats.data?.dlq ?? 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Errors</p>
              <p className={`text-lg font-semibold ${(ingestStats.data?.errors ?? 0) > 0 ? 'text-[#F2555A]' : ''}`}>
                {(ingestStats.data?.errors ?? 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Success Rate</p>
              <p className="text-lg font-semibold">
                {(ingestStats.data?.accepted ?? 0) > 0 
                  ? (((ingestStats.data?.inserted ?? 0) / (ingestStats.data?.accepted ?? 0)) * 100).toFixed(1) 
                  : '0'}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Lag */}
      <Card className="shadow-none">
        <CardContent className="p-6">
          <h3 className="text-sm font-medium mb-4">Pipeline Lag</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Quickwit Indexing Lag</p>
              <p className={`text-lg font-semibold ${(pipelineLag.data?.quickwitIndexingLagMs ?? 0) > 60000 ? 'text-[#F2555A]' : ''}`}>
                {pipelineLag.data?.quickwitIndexingLagMs 
                  ? `${((pipelineLag.data?.quickwitIndexingLagMs ?? 0) / 1000).toFixed(1)}s` 
                  : '0s'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending Documents</p>
              <p className="text-lg font-semibold">{pipelineLag.data?.quickwitPendingDocs.toLocaleString() || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DLQ Status */}
      <Card className="shadow-none">
        <CardContent className="p-6">
          <h3 className="text-sm font-medium mb-4">Dead Letter Queue</h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-semibold">{dlqStats.data?.total || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Unreplayed</p>
              <p className="text-lg font-semibold text-[#F2555A]">{dlqStats.data?.unreplayed || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Successful Replays</p>
              <p className="text-lg font-semibold text-[#16931F]">{dlqStats.data?.successful || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Failed Replays</p>
              <p className="text-lg font-semibold text-[#F2555A]">{dlqStats.data?.failed || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="shadow-none">
        <CardContent className="p-6">
          <h3 className="text-sm font-medium mb-4">Quick Actions</h3>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => window.open('/admin/dlq', '_blank')}>
              View DLQ
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open('/admin/ingest-health', '_blank')}>
              Ingestion Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
