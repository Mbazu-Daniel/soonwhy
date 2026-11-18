import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '~/components/ui/card';
import { api } from '~/lib/api';
import { hostStatus, type Host } from '~/lib/hosts';
import { formatAge } from '~/lib/index-health';
import { useProject } from '~/lib/project-context';

interface ProjectOption {
  id: string;
  name: string;
}

const STATUS_STYLE = {
  reporting: { dot: 'bg-[#16931F]', label: 'Reporting' },
  quiet: { dot: 'bg-[#F59E0B]', label: 'Quiet' },
} as const;

export function HostsCard({ projectId }: { projectId: string }) {
  const { orgId } = useProject();
  const queryClient = useQueryClient();
  const hosts = useQuery({
    queryKey: ['hosts', projectId],
    queryFn: () => api.get<Host[]>(`/projects/${projectId}/hosts`),
    refetchInterval: 30_000,
  });
  const projects = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<ProjectOption[]>('/projects'),
    enabled: !!orgId,
  });
  const move = useMutation({
    mutationFn: (input: { hostId: string; projectId: string }) =>
      api.patch<Host>(`/projects/${projectId}/hosts/${input.hostId}`, { projectId: input.projectId }),
    onSuccess: async () => {
      toast.success('Host moved');
      await queryClient.invalidateQueries({ queryKey: ['hosts'] });
      await queryClient.invalidateQueries({ queryKey: ['host-metrics'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = hosts.data ?? [];
  const others = (projects.data ?? []).filter((project) => project.id !== projectId);

  return (
    <Card className="border-border bg-card shadow-none">
      <CardContent className="p-5">
        <div className="mb-4">
          <p className="text-sm font-medium">Hosts</p>
          <p className="text-xs text-muted-foreground">Servers whose metrics are filed under this project</p>
        </div>
        {hosts.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading hosts…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hosts yet. A host appears here the first time its collector reports.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((host) => {
              const status = STATUS_STYLE[hostStatus(host)];
              return (
                <li key={host.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{host.hostName}</span>
                  <span className="text-xs text-muted-foreground">{status.label} · seen {formatAge(host.lastSeenAt)}</span>
                  {others.length > 0 && (
                    <select
                      aria-label={`Move ${host.hostName} to another project`}
                      value=""
                      disabled={move.isPending}
                      onChange={(event) => event.target.value && move.mutate({ hostId: host.id, projectId: event.target.value })}
                      className="h-8 rounded-lg border border-border bg-muted px-2 text-xs text-foreground"
                    >
                      <option value="">Move to…</option>
                      {others.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
