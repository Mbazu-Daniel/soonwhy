import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Bell, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { QueryErrorState } from '~/components/query-error-state';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/notifications')({ component: NotificationsPage });

interface NotificationLog {
  id: string;
  channelType: 'email' | 'slack' | 'webhook';
  status: 'sent' | 'failed' | 'pending';
  incidentId: string | null;
  alertRuleId: string | null;
  error: string | null;
  createdAt: string;
}

const PAGE_SIZE = 50;

const STATUS_TREATMENT: Record<NotificationLog['status'], string> = {
  sent: 'bg-[#0B0B0C] text-[#ACFC15] border-[#16931F]',
  failed: 'bg-[#FDE8E6] text-[#8A1C13] border-[#F8C7C2]',
  pending: 'bg-secondary text-[#4D5A4A] border-[#242426]',
};

function StatusIcon({ status }: { status: NotificationLog['status'] }) {
  if (status === 'sent') return <CheckCircle2 className="h-3.5 w-3.5 text-[#16931F]" />;
  if (status === 'failed') return <XCircle className="h-3.5 w-3.5 text-[#8A1C13]" />;
  return <Clock3 className="h-3.5 w-3.5 text-[#989898]" />;
}

function EmptyProject() {
  return (
    <div className="p-10 text-center text-muted-foreground">
      <p className="font-medium">Choose a project</p>
      <p className="mt-1 text-sm">Select a project from the sidebar to view notifications.</p>
    </div>
  );
}

function NotificationsPage() {
  const { projectId } = useProject();
  const [offset, setOffset] = useState(0);
  const [accumulated, setAccumulated] = useState<NotificationLog[]>([]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notification-logs', projectId, offset],
    queryFn: () =>
      api.get<{ items: NotificationLog[]; hasMore: boolean }>(
        `/projects/${projectId}/notifications/logs?limit=${PAGE_SIZE}&offset=${offset}`,
      ),
    enabled: !!projectId,
  });

  const rows = useMemo(() => [...accumulated, ...(data?.items ?? [])], [accumulated, data]);

  if (!projectId) return <EmptyProject />;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <div className="border border-[#242426] rounded-lg bg-[#0B0B0C] overflow-hidden">
        <table className="w-full text-sm text-left text-[#F6F6F6]">
          <thead className="text-xs text-[#989898] border-b border-[#242426] bg-[#0B0B0C]">
            <tr className="h-10">
              <th className="p-3">TIME</th>
              <th className="p-3">CHANNEL</th>
              <th className="p-3">STATUS</th>
              <th className="p-3">INCIDENT</th>
              <th className="p-3">DETAIL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#242426]">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td className="p-3" colSpan={5}><Skeleton className="h-5" /></td></tr>
              ))
            ) : isError ? (
              <tr><td colSpan={5} className="p-0"><QueryErrorState onRetry={() => void refetch()} /></td></tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-[#242426] last:border-0 hover:bg-[#151517]/50">
                  <td className="p-3 whitespace-nowrap">
                    <time className="font-mono text-[11px] text-[#989898]">{new Date(row.createdAt).toLocaleString()}</time>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <Badge variant="outline" className="text-[10px] uppercase">{row.channelType}</Badge>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <StatusIcon status={row.status} />
                      <Badge variant="outline" className={`text-[10px] uppercase ${STATUS_TREATMENT[row.status]}`}>{row.status}</Badge>
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-[11px] text-[#6E6E70]">{row.incidentId ?? row.alertRuleId ?? '-'}</span>
                  </td>
                  <td className="p-3">
                    {row.error
                      ? <span className="block max-w-[420px] truncate text-xs text-[#8A1C13]" title={row.error}>{row.error}</span>
                      : <span className="text-xs text-[#6E6E70]">—</span>}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-10 text-center">
                  <Bell className="mx-auto h-8 w-8 text-[#16931F]" />
                  <p className="mt-3 font-medium">No notifications yet</p>
                  <p className="mt-1 text-sm text-[#989898]">Alert deliveries will appear here once your channels fire.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data?.hasMore ? (
        <Button variant="outline" size="sm" className="mx-auto block" onClick={() => { setAccumulated(rows); setOffset(offset + PAGE_SIZE); }}>
          Load more
        </Button>
      ) : null}
    </div>
  );
}
