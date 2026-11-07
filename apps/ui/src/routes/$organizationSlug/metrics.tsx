import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, ArrowUpRight, Clock3, Server, Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';
import { TimeRangeControl, telemetryRangeParams, type TelemetryRange } from '~/components/telemetry/time-range-control';
import { MetricCard, StatusCodeBreakdown, LatencyDistribution } from '~/components/metric-cards';

export const Route = createFileRoute('/$organizationSlug/metrics')({
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

function MetricsPage() {
  const { projectId, orgSlug } = useProject();
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

  if (!projectId) return <EmptyProject />;
  if (isError)
    return (
      <QueryErrorState onRetry={() => void refetch()} />
    );

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

  return (
    <div className="mx-auto w-full space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="sr-only">Metrics</h1>
        <div className="flex items-center gap-2 rounded-lg border border-[#242426] bg-[#0B0B0C] px-3 py-2 text-xs text-[#989898] shadow-[0_1px_2px_rgba(24,32,18,.03)]">
          <span className="h-2 w-2 rounded-full bg-[#ACFC15]" />
          Last 24 hours
        </div>
      </div>

      <TimeRangeControl value={range} onChange={setRange} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total requests"
          value={totalRequests.toLocaleString()}
          icon={Activity}
        />
        <MetricCard
          label="Error rate"
          value={errorRate.toFixed(2)}
          suffix="%"
          icon={AlertTriangle}
          trend={{
            value: 0,
            direction: 'flat',
            isGood: true,
          }}
        />
        <MetricCard
          label="P95 latency"
          value={String(avgP95)}
          suffix="ms"
          icon={Clock3}
        />
        <MetricCard
          label="P99 latency"
          value={String(avgP99)}
          suffix="ms"
          icon={Zap}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.75fr)]">
        <Card className="overflow-hidden rounded-xl border-[#242426] bg-[#0B0B0C] shadow-[0_8px_30px_rgba(24,32,18,.04)]">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-[#1B1B1D] px-5 py-5 sm:px-6">
              <h2 className="text-sm font-semibold text-[#F6F6F6]">Requests over time</h2>
              <Link
                to="/$organizationSlug/services"
                params={{ organizationSlug: orgSlug! }}
                className="text-xs font-medium text-[#ACFC15] hover:underline"
              >
                View services <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </div>
            <div className="px-5 pb-6 pt-4 sm:px-6">
              <RequestRateChart buckets={buckets} />
              <div className="mt-3 flex justify-between text-[10px] text-[#6E6E70]">
                {buckets.slice(0, Math.min(buckets.length, 5)).map((b) => (
                  <span key={b.bucket}>{new Date(b.bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-xl border-[#242426] bg-[#0B0B0C] shadow-[0_8px_30px_rgba(24,32,18,.04)]">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-[#1B1B1D] px-5 py-5 sm:px-6">
              <h2 className="text-sm font-semibold text-[#F6F6F6]">Latency over time</h2>
            </div>
            <div className="px-5 pb-6 pt-4 sm:px-6">
              <LatencyChart buckets={buckets || []} />
              <div className="mt-3 flex justify-between text-[10px] text-[#6E6E70]">
                {(buckets || []).slice(0, Math.min((buckets || []).length, 5)).map((b) => (
                  <span key={b.bucket}>{new Date(b.bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <StatusCodeBreakdown
          codes={[
            { label: '2xx', percentage: (buckets || []).length > 0 ? Math.round(((latestStatus._2xx ?? 0) / (statusTotal || 1)) * 100) : 0, color: 'bg-[#16931F]' },
            { label: '4xx', percentage: (buckets || []).length > 0 ? Math.round(((latestStatus._4xx ?? 0) / (statusTotal || 1)) * 100) : 0, color: 'bg-[#F2C66D]' },
            { label: '5xx', percentage: (buckets || []).length > 0 ? Math.round(((latestStatus._5xx ?? 0) / (statusTotal || 1)) * 100) : 0, color: 'bg-[#F28B82]' },
          ]}
        />
        <LatencyDistribution
          p50={(buckets || []).reduce((sum, b) => sum + b.p50, 0) / Math.max((buckets || []).length, 1)}
          p95={avgP95}
          p99={avgP99}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-xl border-[#242426] bg-[#0B0B0C] shadow-[0_8px_30px_rgba(24,32,18,.04)]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between border-b border-[#1B1B1D] pb-4">
              <h2 className="text-sm font-semibold text-[#F6F6F6]">Slowest endpoints</h2>
              <Link
                to="/$organizationSlug/traces"
                params={{ organizationSlug: orgSlug! }}
                className="text-xs font-medium text-[#ACFC15] hover:underline"
              >
                View traces <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3 pt-4">
              {(buckets || [])
                .filter((b) => b.p95 > 0)
                .sort((a, b) => b.p95 - a.p95)
                .slice(0, 8)
                .map((b, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-[#151517] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2 w-2 rounded-full ${i < 3 ? 'bg-[#F28B82]' : 'bg-[#1B1B1D]'}`}
                      />
                      <span className="text-xs font-medium text-[#F6F6F6] truncate w-32">
                        {b.bucket}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-[#F6F6F6]">{b.p95}ms</span>
                      <span className="text-[10px] text-[#989898]">p95</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function RequestRateChart({ buckets }: { buckets: MetricsBucket[] }) {
  if (!buckets.length) {
    return (
      <div className="h-[200px] flex items-center justify-center text-[#989898] text-xs">
        No request data available
      </div>
    );
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const width = 100;
  const height = 160;
  const padding = { top: 10, right: 10, bottom: 20, left: 30 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = buckets
    .map((b, i) => {
      const x = padding.left + (i / Math.max(buckets.length - 1, 1)) * chartWidth;
      const y = padding.top + chartHeight - (b.count / maxCount) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = [
    `0,${padding.top + chartHeight}`,
    ...buckets.map((b, i) => {
      const x = padding.left + (i / Math.max(buckets.length - 1, 1)) * chartWidth;
      const y = padding.top + chartHeight - (b.count / maxCount) * chartHeight;
      return `${x},${y}`;
    }),
    `${padding.left + chartWidth},${padding.top + chartHeight}`,
  ].join(' ');

  return (
    <div className="h-[200px] w-full">
      <svg
        width={width}
        height={height}
        className="block"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id="reqGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#16931F" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#16931F" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path
          d={`M${areaPoints} Z`}
          fill="url(#reqGradient)"
          className="fill-current"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#16931F"
          strokeWidth="2"
          className="fill-none"
        />
        {buckets.map((b, i) => {
          const x = padding.left + (i / Math.max(buckets.length - 1, 1)) * chartWidth;
          const y = padding.top + chartHeight - (b.count / maxCount) * chartHeight;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2}
              fill="#16931F"
              className="fill-current"
            />
          );
        })}
      </svg>
      <div className="mt-2 text-[10px] text-[#989898]">
        Max: {maxCount} requests per interval
      </div>
    </div>
  );
}

function LatencyChart({ buckets }: { buckets: MetricsBucket[] }) {
  if (!buckets.length) {
    return (
      <div className="h-[200px] flex items-center justify-center text-[#989898] text-xs">
        No latency data available
      </div>
    );
  }

  const maxLatency = Math.max(...buckets.map((b) => b.p99 || b.p95 || 0), 1);
  const width = 100;
  const height = 160;
  const padding = { top: 10, right: 10, bottom: 20, left: 30 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = buckets
    .map((b, i) => {
      const x = padding.left + (i / Math.max(buckets.length - 1, 1)) * chartWidth;
      const y = padding.top + chartHeight - ((b.p99 || b.p95 || 0) / maxLatency) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = [
    `0,${padding.top + chartHeight}`,
    ...buckets.map((b, i) => {
      const x = padding.left + (i / Math.max(buckets.length - 1, 1)) * chartWidth;
      const y = padding.top + chartHeight - ((b.p99 || b.p95 || 0) / maxLatency) * chartHeight;
      return `${x},${y}`;
    }),
    `${padding.left + chartWidth},${padding.top + chartHeight}`,
  ].join(' ');

  return (
    <div className="h-[200px] w-full">
      <svg
        width={width}
        height={height}
        className="block"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id="latGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ACFC15" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ACFC15" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path
          d={`M${areaPoints} Z`}
          fill="url(#latGradient)"
          className="fill-current"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#ACFC15"
          strokeWidth="2"
          className="fill-none"
        />
        {buckets.map((b, i) => {
          const x = padding.left + (i / Math.max(buckets.length - 1, 1)) * chartWidth;
          const y = padding.top + chartHeight - ((b.p99 || b.p95 || 0) / maxLatency) * chartHeight;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2}
              fill="#ACFC15"
              className="fill-current"
            />
          );
        })}
      </svg>
      <div className="mt-2 text-[10px] text-[#989898]">
        Max: {Math.round(maxLatency)}ms p99
      </div>
    </div>
  );
}

function EmptyProject() {
  return (
    <Card className="rounded-2xl border-dashed border-[#242426] bg-[#0B0B0C]">
      <CardContent className="p-12 text-center">
        <Server className="mx-auto h-6 w-6 text-[#16931F]" />
        <p className="mt-3 text-sm font-medium">Choose a project</p>
        <p className="mt-1 text-sm text-[#989898]">
          Select a project from the top bar to view its metrics.
        </p>
      </CardContent>
    </Card>
  );
}
