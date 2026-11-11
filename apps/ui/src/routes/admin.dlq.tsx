import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshCw, Trash2, Download, Play, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/dlq')({
  component: DlqPage,
});

interface DlqEntry {
  id: number;
  signal: string;
  deliveryCount: number;
  reason: string;
  failedAt: string;
  payload: unknown;
  replayed: boolean;
  replayedAt: string | null;
  replaySuccess: boolean | null;
  replayAttempts: number;
  replayError: string | null;
  organizationId: string | null;
  projectId: string | null;
}

interface DlqStats {
  total: number;
  unreplayed: number;
  replayed: number;
  successful: number;
  failed: number;
}

function DlqPage() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showPayload, setShowPayload] = useState<number | null>(null);
  const platform = useQuery({ queryKey: ['platform-admin-me'], queryFn: () => api.get<{ platformRole: 'none' | 'admin' | 'super_admin' }>('/admin/me'), retry: false, staleTime: 300_000 });
  const canMutate = platform.data?.platformRole === 'super_admin';

  const entries = useQuery({
    queryKey: ['dlq-entries'],
    queryFn: () => api.get<DlqEntry[]>('/admin/dlq'),
    refetchInterval: 30000,
  });

  const stats = useQuery({
    queryKey: ['dlq-stats'],
    queryFn: () => api.get<DlqStats>('/admin/dlq/stats'),
    refetchInterval: 30000,
  });

  const replay = useMutation({
    mutationFn: (id: number) => api.post(`/admin/dlq/${id}/replay`),
    onSuccess: () => {
      toast.success('Entry replayed successfully');
      void queryClient.invalidateQueries({ queryKey: ['dlq-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['dlq-stats'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkReplay = useMutation({
    mutationFn: (ids: number[]) => api.post('/admin/dlq/bulk-replay', { ids }),
    onSuccess: (result: any) => {
      toast.success(`Replayed ${result.successful} entries, ${result.failed} failed`);
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: ['dlq-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['dlq-stats'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteEntry = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/dlq/${id}`),
    onSuccess: () => {
      toast.success('Entry deleted');
      void queryClient.invalidateQueries({ queryKey: ['dlq-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['dlq-stats'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkDelete = useMutation({
    mutationFn: (ids: number[]) => api.delete('/admin/dlq/bulk-delete', { ids }),
    onSuccess: () => {
      toast.success('Entries deleted');
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: ['dlq-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['dlq-stats'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const exportEntry = useMutation({
    mutationFn: (id: number) => api.get<DlqEntry>(`/admin/dlq/${id}/export`),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dlq-entry-${data.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Entry exported');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (entries.isError) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="text-red-500">Failed to load DLQ entries</p>
          <Button onClick={() => void entries.refetch()} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = entries.data ?? [];
  const statsData = stats.data ?? { total: 0, unreplayed: 0, replayed: 0, successful: 0, failed: 0 };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Dead Letter Queue</h1>
          <p className="text-xs text-[#989898]">Inspect and replay failed telemetry messages</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void entries.refetch()}
            disabled={entries.isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${entries.isLoading ? 'animate-spin' : ''}`} />
          </Button>
          {canMutate && selectedIds.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkReplay.mutate(selectedIds)}
                disabled={bulkReplay.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                Replay ({selectedIds.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkDelete.mutate(selectedIds)}
                disabled={bulkDelete.isPending}
                className="text-red-500 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedIds.length})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-5">
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-2 text-lg font-semibold">{statsData.total}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Unreplayed</p>
            <p className="mt-2 text-lg font-semibold text-[#F2555A]">{statsData.unreplayed}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Replayed</p>
            <p className="mt-2 text-lg font-semibold">{statsData.replayed}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Successful</p>
            <p className="mt-2 text-lg font-semibold text-[#16931F]">{statsData.successful}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="mt-2 text-lg font-semibold text-[#F2555A]">{statsData.failed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Entries Table */}
      <Card className="overflow-hidden shadow-none">
        <CardContent className="p-0">
          {entries.isLoading ? (
            <div className="p-10 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <AlertTriangle className="mx-auto h-10 w-10 text-[#6E6E70]" />
              <h3 className="mt-3 text-sm font-medium">No DLQ entries</h3>
              <p className="mt-1 text-sm">All telemetry is being processed successfully</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="p-4 text-left text-sm font-medium">
                      {canMutate && (
                      <input
                        type="checkbox"
                        checked={selectedIds.length === data.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(data.map((d) => d.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                      />
                      )}
                    </th>
                    <th className="p-4 text-left text-sm font-medium">ID</th>
                    <th className="p-4 text-left text-sm font-medium">Signal</th>
                    <th className="p-4 text-left text-sm font-medium">Reason</th>
                    <th className="p-4 text-left text-sm font-medium">Failed At</th>
                    <th className="p-4 text-left text-sm font-medium">Status</th>
                    <th className="p-4 text-left text-sm font-medium">Attempts</th>
                    <th className="p-4 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((entry) => (
                    <tr key={entry.id} className="border-b border-border hover:bg-muted/30">
                      <td className="p-4">
                        {canMutate && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(entry.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds([...selectedIds, entry.id]);
                            } else {
                              setSelectedIds(selectedIds.filter((id) => id !== entry.id));
                            }
                          }}
                        />
                        )}
                      </td>
                      <td className="p-4 text-sm font-mono">{entry.id}</td>
                      <td className="p-4">
                        <Badge variant="outline">{entry.signal}</Badge>
                      </td>
                      <td className="p-4 text-sm max-w-xs truncate" title={entry.reason}>
                        {entry.reason}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(entry.failedAt).toLocaleString()}
                      </td>
                      <td className="p-4">
                        {entry.replayed ? (
                          entry.replaySuccess ? (
                            <Badge className="bg-[#16931F]/10 text-[#16931F]">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge className="bg-[#F2555A]/10 text-[#F2555A]">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </td>
                      <td className="p-4 text-sm">{entry.replayAttempts}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowPayload(entry.id)}
                            title="View payload"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {canMutate && (!entry.replayed || !entry.replaySuccess) ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => replay.mutate(entry.id)}
                              disabled={replay.isPending}
                              title="Replay"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => exportEntry.mutate(entry.id)}
                            disabled={exportEntry.isPending}
                            title="Export"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {canMutate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteEntry.mutate(entry.id)}
                            disabled={deleteEntry.isPending}
                            className="text-red-500 hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payload Viewer */}
      {showPayload !== null && (
        <Card className="shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Payload for Entry #{showPayload}</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowPayload(null)}>
                Close
              </Button>
            </div>
            <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-xs">
              {JSON.stringify(data.find((d) => d.id === showPayload)?.payload, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
