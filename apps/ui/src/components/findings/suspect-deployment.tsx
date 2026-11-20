import { useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import type { DetectionFinding, SuspectDeployment } from '~/lib/findings.types';

export function SuspectDeploymentRow({ projectId, finding }: { projectId: string; finding: DetectionFinding }) {
  const { data } = useQuery({
    queryKey: ['finding-detail', projectId, finding.id],
    queryFn: () => api.get<DetectionFinding & { suspectDeployment: SuspectDeployment | null }>(`/projects/${projectId}/findings/${finding.id}`),
  });
  const deploy = data?.suspectDeployment;
  if (!deploy) return null;
  const label = deploy.version ?? deploy.commitSha?.slice(0, 7) ?? 'a deploy';
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <p className="font-medium">Started after a deploy</p>
      <p className="text-muted-foreground">
        {finding.serviceName} {label} went out {deploy.minutesBeforeFinding} min before this was first detected.
      </p>
    </div>
  );
}
