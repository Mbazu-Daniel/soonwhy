import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import type { OperationStats, ServiceOperations } from '~/components/service/service-operations.types';

interface Props {
  projectId: string;
  serviceId: string;
  rangeKey: string;
  from: string;
  to: string;
}

function formatMs(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
}

function StatsTable({ rows, label, empty }: { rows: Array<OperationStats & { type?: string }>; label: string; empty: string }) {
  if (!rows.length) return <p className="p-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th className="p-3">{label}</th>
            <th className="p-3 text-right">Requests</th>
            <th className="p-3 text-right">Errors</th>
            <th className="p-3 text-right">Avg</th>
            <th className="p-3 text-right">P95</th>
            <th className="p-3 text-right">P99</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={`${row.type ?? ''}:${row.name}`}>
              <td className="max-w-[320px] truncate p-3 font-mono text-xs" title={row.name}>
                {row.name}
                {row.type && <span className="ml-2 rounded border px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">{row.type}</span>}
              </td>
              <td className="p-3 text-right tabular-nums">{row.requests.toLocaleString()}</td>
              <td className={`p-3 text-right tabular-nums ${row.errors ? 'text-[#F28B82]' : 'text-muted-foreground'}`}>
                {row.errors.toLocaleString()} <span className="text-[11px]">({row.errorRate}%)</span>
              </td>
              <td className="p-3 text-right tabular-nums">{formatMs(row.avgMs)}</td>
              <td className="p-3 text-right tabular-nums">{formatMs(row.p95Ms)}</td>
              <td className="p-3 text-right tabular-nums">{formatMs(row.p99Ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ServiceOperationsPanels({ projectId, serviceId, rangeKey, from, to }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['service-operations', projectId, serviceId, rangeKey],
    queryFn: () => api.get<ServiceOperations>(`/projects/${projectId}/services/${serviceId}/operations?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    placeholderData: keepPreviousData,
    retry: 1,
  });

  if (isLoading) return <Skeleton className="h-48" />;
  if (isError && !data) {
    return <p className="rounded-xl border px-4 py-3 text-sm text-muted-foreground">Operations are temporarily unavailable.</p>;
  }

  return (
    <div className="space-y-4">
      {data && data.failing.length > 0 && (
        <Card className="border-border shadow-none">
          <CardHeader><CardTitle className="text-base">Failing operations</CardTitle><p className="text-xs text-muted-foreground">Operations with the most error spans in this range</p></CardHeader>
          <CardContent className="p-0"><StatsTable rows={data.failing} label="Operation" empty="" /></CardContent>
        </Card>
      )}
      <Card className="border-border shadow-none">
        <CardHeader><CardTitle className="text-base">Operations</CardTitle><p className="text-xs text-muted-foreground">Incoming requests: server, consumer and root spans</p></CardHeader>
        <CardContent className="p-0"><StatsTable rows={data?.operations ?? []} label="Operation" empty="No incoming requests in this range." /></CardContent>
      </Card>
      <Card className="border-border shadow-none">
        <CardHeader><CardTitle className="text-base">Dependencies</CardTitle><p className="text-xs text-muted-foreground">Outgoing calls: client and producer spans</p></CardHeader>
        <CardContent className="p-0"><StatsTable rows={data?.dependencies ?? []} label="Dependency" empty="No outgoing calls in this range." /></CardContent>
      </Card>
    </div>
  );
}
