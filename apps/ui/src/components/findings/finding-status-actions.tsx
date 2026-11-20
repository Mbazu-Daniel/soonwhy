import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { api } from '~/lib/api';
import { statusActions } from '~/lib/findings';
import type { DetectionFinding, FindingStatus } from '~/lib/findings.types';

export function FindingStatusActions({ projectId, finding }: { projectId: string; finding: DetectionFinding }) {
  const queryClient = useQueryClient();
  const change = useMutation({
    mutationFn: (status: FindingStatus) => api.patch(`/projects/${projectId}/findings/${finding.id}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['detections', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['finding-report', projectId] });
    },
    onError: () => toast.error('Could not update the finding'),
  });

  return (
    <div className="flex flex-wrap gap-2">
      {statusActions(finding.status).map((action) => (
        <Button
          key={action.to}
          size="sm"
          variant={action.to === 'resolved' ? 'default' : 'outline'}
          disabled={change.isPending}
          onClick={() => change.mutate(action.to)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
