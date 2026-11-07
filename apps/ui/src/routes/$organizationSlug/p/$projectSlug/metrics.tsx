import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Clock3, Zap, Cpu, HardDrive, MemoryStick, Network } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';
import { TimeRangeControl, telemetryRangeParams, type TelemetryRange } from '~/components/telemetry/time-range-control';
import { MetricCard, StatusCodeBreakdown, LatencyDistribution } from '~/components/metric-cards';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/metrics')({
  component: MetricsPage,
});

interface MetricsBucket {
  bucket: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  statusCodes: { _2xx: number; _3xx: number; _4xx: number; _5xx: number };
}

interface MetricsResponse {
  buckets: MetricsBucket[];
}

interface HostMetricsBucket {
  bucket: string;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  network_in_bytes: number;
  network_out_bytes: number;
}

interface HostMetricsResponse {
  buckets: HostMetricsBucket[];
}

function MetricsPage() {
  const { projectId } = useProject();
  const [range, setRange] = useState<TelemetryRange>('24h');
  const { from, to } = telemetryRangeParams(range);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['metrics', projectId, range],
    queryFn: () =>
      api.get<MetricsResponse>(
        `/metrics?projectId=${encodeURIComponent(projectId!)}&from=${from}&to=${to}&interval=5m`,
      ),
    enabled: !!projectId,
    refetchInterval: 15_000,
  });

  const { data: hostData, isLoading: hostLoading, isError: hostError, refetch: refetchHost } = useQuery({
    queryKey: ['host-metrics', range],
    queryFn: () =>
      api.get<HostMetricsResponse>(
        `/metrics/host?from=${from}&to=${to}&interval=1m`,
      ),
    refetchInterval: 15_000,
  });

  if (!projectId) return <EmptyProject />;
  if (isError)
    return <QueryErrorState onRetry={() => void refetch()} />;

  const buckets = data?.buckets ?? [];
  const totalRequests = buckets.reduce((sum, b) => sum + b.count, 0);
  const totalErrors = buckets.reduce((sum, b) => sum + (b.statusCodes._4xx ?? 0) + (b.statusCodes._5xx ?? 0), 0);
  const errorRate = totalRequests ? (totalErrors / totalRequests) * 100 : 0;
  const p95s = buckets.filter((b) => b.p95 > 0);
  const avgP95 = p95s.length ? Math.round(p95s.reduce((sum, b) => sum + b.p95, 0) / p95s.length) : 0;
  const avgP99 = buckets.filter((b) => b.p99 > 0).length
    ? Math.round(
        buckets
          .filter((b) => b.p99 > 0)
          .reduce((sum, b) => sum + b.p99, 0) /
          buckets.filter((b) => b.p99 > 0).length,
      )
    : 0;

  const latestStatus = buckets[buckets.length - 1]?.statusCodes ?? {};
  const statusTotal =
    (latestStatus._2xx ?? 0) +
    (latestStatus._3xx ?? 0) +
    (latestStatus._4xx ?? 0) +
    (latestStatus._5xx ?? 0);

  const hostBuckets = hostData?.buckets ?? [];
  const latestHost = hostBuckets[hostBuckets.length - 1];
  const avgCpu = hostBuckets.length ? hostBuckets.reduce((sum, b) => sum + b.cpu_percent, 0) / hostBuckets.length : 0;
  const avgMemory = hostBuckets.length ? hostBuckets.reduce((sum, b) => sum + b.memory_percent, 0) / hostBuckets.length : 0;
  const avgDisk = hostBuckets.length ? hostBuckets.reduce((sum, b) => sum + b.disk_percent, 0) / hostBuckets.length : 0;

  return (
    <div className="mx-auto w-full space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="sr-only">Metrics</h1>
      </div>

      <TimeRangeControl value={range} onChange={setRange} />

      <Tabs defaultValue="application">
        <TabsList>
          <TabsTrigger value="application">Application</TabsTrigger>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
        </TabsList>
        <TabsContent value="application" className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total requests" value={totalRequests.toLocaleString()} icon={Activity} />
            <MetricCard label="Error rate" value={errorRate.toFixed(2)} suffix="%" icon={AlertTriangle} />
            <MetricCard label="P95 latency" value={String(avgP95)} suffix="ms" icon={Clock3} />
            <MetricCard label="P99 latency" value={String(avgP99)} suffix="ms" icon={Zap} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.75fr)]">
            <Card className="overflow-hidden border-border bg-card shadow-none">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div>
                    <p className="text-sm font-medium">Request volume</p>
                    <p className="text-xs text-muted-foreground">Total requests over time</p>
                  </div>
                </div>
                <div className="h-80 px-5 py-4">
                  {isLoading ? (
                    <div className="flex h-full items-end gap-2">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <Skeleton key={i} className="flex-1" style={{ height: `${30 + i * 4}%` }} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full items-end gap-2">
                      {(buckets || []).map((bucket) => {
                        const max = Math.max(1, ...((buckets || []).map((b) => b.count)));
                        const height = Math.max(6, (bucket.count / max) * 100);
                        return (
                          <div
                            key={bucket.bucket}
                            className="group relative flex flex-1 items-end"
                            title={`${new Date(bucket.bucket).toLocaleString()}: ${bucket.count} requests`}
                          >
                            <div className="w-full rounded-t bg-[#16931F]/70 transition-colors group-hover:bg-[#16931F]" style={{ height: `${height}%` }} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card shadow-none">
              <CardContent className="p-5">
                <div className="mb-4">
                  <p className="text-sm font-medium">Status codes</p>
                  <p className="text-xs text-muted-foreground">Latest interval</p>
                </div>
                <StatusCodeBreakdown
                  codes={[
                    { label: '2xx', percentage: statusTotal ? Math.round(((latestStatus._2xx ?? 0) / statusTotal) * 100) : 0, color: 'bg-[#16931F]' },
                    { label: '4xx', percentage: statusTotal ? Math.round(((latestStatus._4xx ?? 0) / statusTotal) * 100) : 0, color: 'bg-[#F2C66D]' },
                    { label: '5xx', percentage: statusTotal ? Math.round(((latestStatus._5xx ?? 0) / statusTotal) * 100) : 0, color: 'bg-[#F28B82]' },
                  ]}
                />
              </CardContent>
            </Card>
          </section>

          <section>
            <Card className="border-border bg-card shadow-none">
              <CardContent className="p-5">
                <div className="mb-4">
                  <p className="text-sm font-medium">Latency</p>
                  <p className="text-xs text-muted-foreground">P50 / P95 / P99</p>
                </div>
                <LatencyDistribution p50={(buckets || [])[0]?.p50 || 0} p95={avgP95} p99={avgP99} />
              </CardContent>
            </Card>
          </section>
        </TabsContent>
        <TabsContent value="infrastructure" className="space-y-6">
          {hostError ? (
            <QueryErrorState onRetry={() => void refetchHost()} />
          ) : (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="CPU" value={avgCpu.toFixed(1)} suffix="%" icon={Cpu} />
                <MetricCard label="Memory" value={avgMemory.toFixed(1)} suffix="%" icon={MemoryStick} />
                <MetricCard label="Disk" value={avgDisk.toFixed(1)} suffix="%" icon={HardDrive} />
                <MetricCard label="Network I/O" value="Ingesting" icon={Network} />
              </section>

              <Card className="border-border bg-card shadow-none">
                <CardContent className="p-5">
                  <div className="mb-4">
                    <p className="text-sm font-medium">Host Metrics</p>
                    <p className="text-xs text-muted-foreground">CPU, memory, and disk utilization over time</p>
                  </div>
                  {hostLoading ? (
                    <div className="h-64 flex items-center justify-center">
                      <Skeleton className="h-full w-full" />
                    </div>
                  ) : hostBuckets.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      <p>No host metrics available yet. Ensure the OTel collector is running.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">CPU %</p>
                        <div className="h-16 flex items-end gap-1">
                          {hostBuckets.map((bucket, i) => (
                            <div
                              key={i}
                              className="flex-1 bg-blue-500/60 rounded-t"
                              style={{ height: `${Math.max(4, bucket.cpu_percent)}%` }}
                              title={`${bucket.cpu_percent.toFixed(1)}%`}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Memory %</p>
                        <div className="h-16 flex items-end gap-1">
                          {hostBuckets.map((bucket, i) => (
                            <div
                              key={i}
                              className="flex-1 bg-green-500/60 rounded-t"
                              style={{ height: `${Math.max(4, bucket.memory_percent)}%` }}
                              title={`${bucket.memory_percent.toFixed(1)}%`}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Disk %</p>
                        <div className="h-16 flex items-end gap-1">
                          {hostBuckets.map((bucket, i) => (
                            <div
                              key={i}
                              className="flex-1 bg-yellow-500/60 rounded-t"
                              style={{ height: `${Math.max(4, bucket.disk_percent)}%` }}
                              title={`${bucket.disk_percent.toFixed(1)}%`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyProject() {
  return (
    <Card>
      <CardContent className="p-10 text-center">
        <p className="font-medium">Choose a project</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a project from the sidebar to inspect metrics.
        </p>
      </CardContent>
    </Card>
  );
}
