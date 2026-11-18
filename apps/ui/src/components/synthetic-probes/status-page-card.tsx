import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { canManageStatusPage, projectSettingsKey, statusPageUrl, type ProjectSettings } from '~/lib/status-page';

export function StatusPageCard() {
  const { projectId, orgId, orgSlug, projectSlug } = useProject();
  const queryClient = useQueryClient();

  const settings = useQuery({
    queryKey: projectSettingsKey(projectId),
    queryFn: () => api.get<ProjectSettings>('/projects/' + projectId + '/settings'),
    enabled: !!projectId,
  });
  const member = useQuery({
    queryKey: ['member-context', orgId],
    queryFn: () => api.get<{ role: string }>('/member-context'),
    enabled: !!orgId,
    retry: false,
    staleTime: 300_000,
  });

  const save = useMutation({
    mutationFn: (statusPagePublic: boolean) => api.put<ProjectSettings>('/projects/' + projectId + '/settings', { statusPagePublic }),
    onSuccess: (next) => {
      queryClient.setQueryData(projectSettingsKey(projectId), next);
      toast.success(next.statusPagePublic ? 'Status page is public' : 'Status page is private');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!settings.data) return null;
  const enabled = settings.data.statusPagePublic;
  const canManage = canManageStatusPage(member.data?.role);
  const address = statusPageUrl(window.location.origin, orgSlug, projectSlug);

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold"><Globe className="h-4 w-4" />Public status page</p>
            <p className="mt-1 text-sm text-[#989898]">
              Anyone with the link can see your enabled probes by name, with their uptime and recent incidents. Probe addresses are never shown.
            </p>
          </div>
          <Button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Public status page"
            variant="outline"
            disabled={!canManage || save.isPending}
            onClick={() => save.mutate(!enabled)}
            className={enabled ? 'border-[#ACFC15] text-[#ACFC15]' : 'border-[#242426] text-[#989898]'}
          >
            {save.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {enabled ? 'On' : 'Off'}
          </Button>
        </div>
        {enabled && address && (
          <p className="text-xs text-[#989898]">
            Public at <a className="underline" href={address} target="_blank" rel="noreferrer">{address}</a>
          </p>
        )}
        {!canManage && <p className="text-xs text-[#989898]">Only an owner or admin can change this.</p>}
      </CardContent>
    </Card>
  );
}
