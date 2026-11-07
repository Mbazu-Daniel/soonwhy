import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Trash2, Edit3, Play } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { QueryErrorState } from '~/components/query-error-state';
import { SyntheticProbeDialog } from '~/components/synthetic-probes/synthetic-probe-dialog';
import { ProbeResultsPanel } from '~/components/synthetic-probes/probe-results-panel';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/synthetic-probes')({
  component: SyntheticProbesPage,
});

interface SyntheticProbe {
  id: number;
  name: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  expectedStatusCode: number;
  timeoutMs: number;
  intervalSeconds: number;
  region: string;
  enabled: boolean;
  lastStatus: string;
  uptimePercent: number;
  totalChecks: number;
  failedChecks: number;
  lastCheckAt: string | null;
  createdAt: string;
}

interface SyntheticProbeInput {
  name: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  expectedStatusCode: number;
  timeoutMs: number;
  intervalSeconds: number;
  region: string;
}

function SyntheticProbesPage() {
  const { projectId } = useProject();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SyntheticProbe | null>(null);
  const [selectedProbe, setSelectedProbe] = useState<SyntheticProbe | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const probes = useQuery({
    queryKey: ['synthetic-probes', projectId],
    queryFn: () => api.get<SyntheticProbe[]>(`/projects/${projectId}/synthetic-probes`),
    enabled: !!projectId,
  });

  const save = useMutation({
    mutationFn: (input: SyntheticProbeInput) => {
      const body = input;
      return editing
        ? api.put<SyntheticProbe>(`/projects/${projectId}/synthetic-probes/${editing.id}`, body)
        : api.post<SyntheticProbe>(`/projects/${projectId}/synthetic-probes`, body);
    },
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ['synthetic-probes', projectId] });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/projects/${projectId}/synthetic-probes/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['synthetic-probes', projectId] }),
  });

  const execute = useMutation({
    mutationFn: (id: number) => api.post(`/projects/${projectId}/synthetic-probes/${id}/execute`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['synthetic-probes', projectId] }),
  });

  if (!projectId) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="font-medium">Choose a project</p>
          <p className="mt-1 text-sm text-muted-foreground">Synthetic probes belong to a project.</p>
        </CardContent>
      </Card>
    );
  }

  if (probes.isError) return <QueryErrorState onRetry={() => void probes.refetch()} />;

  const rows = probes.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Synthetic Probes</h1>
          <p className="text-xs text-[#989898]">Proactive endpoint monitoring with response time tracking.</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormError(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Create probe
        </Button>
      </div>

      {rows.length === 0 && !probes.isLoading ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Play className="mx-auto h-10 w-10 text-[#6E6E70]" />
            <h3 className="mt-3 text-sm font-medium">No synthetic probes yet</h3>
            <p className="mt-1 text-sm text-[#989898]">Create a probe to monitor endpoint availability and response time.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uptime</TableHead>
                <TableHead>Last check</TableHead>
                <TableHead className="w-28 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((probe) => (
                <TableRow 
                  key={probe.id} 
                  className={selectedProbe?.id === probe.id ? 'bg-muted' : 'cursor-pointer hover:bg-muted/50'}
                  onClick={() => setSelectedProbe(probe)}
                >
                  <TableCell className="pl-5">
                    <p className="font-medium">{probe.name}</p>
                    <p className="mt-0.5 text-xs text-[#989898]">{probe.region}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{probe.url}</TableCell>
                  <TableCell className="text-sm">{probe.method}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={
                        probe.lastStatus === 'up' ? 'text-[#ACFC15] border-[#16931F]' : 
                        probe.lastStatus === 'down' ? 'text-[#F2555A] border-[#F2555A]' : 
                        'text-[#F2C66D] border-[#F2C66D]'
                      }
                    >
                      {probe.lastStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={probe.uptimePercent >= 99 ? 'text-[#ACFC15]' : probe.uptimePercent >= 95 ? 'text-[#F2C66D]' : 'text-[#F2555A]'}>
                      {probe.uptimePercent}%
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {probe.lastCheckAt ? new Date(probe.lastCheckAt).toLocaleString() : 'Never'}
                  </TableCell>
                  <TableCell className="pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => execute.mutate(probe.id)}
                      disabled={execute.isPending}
                      title="Run probe now"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(probe); setFormError(null); setOpen(true); }}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-[#F2555A] hover:bg-[#F2555A]/10 hover:text-[#F2555A]"
                      aria-label={`Delete ${probe.name}`}
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm(`Delete probe ${probe.name}?`)) remove.mutate(probe.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {selectedProbe && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{selectedProbe.name} - Results</h2>
            <Button variant="outline" size="sm" onClick={() => setSelectedProbe(null)}>Close</Button>
          </div>
          <ProbeResultsPanel projectId={projectId} probeId={selectedProbe.id} />
        </div>
      )}

      <SyntheticProbeDialog
        open={open}
        onOpenChange={setOpen}
        probe={editing}
        pending={save.isPending}
        error={formError}
        onSubmit={(input) => save.mutate(input)}
      />
    </div>
  );
}
