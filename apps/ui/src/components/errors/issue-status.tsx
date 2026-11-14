import type { ReactNode } from 'react';
import { CheckCircle2, EyeOff, Loader2, RotateCcw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { api } from '~/lib/api';
import type { ErrorIssueState, IssueStatus } from '~/lib/error-groups';
import { STATUS_LABELS } from '~/lib/error-status';

const BADGE_STYLES: Record<IssueStatus, string> = {
  unresolved: 'border-border text-muted-foreground',
  regressed: 'border-[#F8C7C2] bg-[#FDE8E6] text-[#8A1C13]',
  resolved: 'border-[#BFE3C2] bg-[#E6F6E7] text-[#16931F]',
  ignored: 'border-border bg-muted text-muted-foreground',
};

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return <Badge variant="outline" className={BADGE_STYLES[status]}>{STATUS_LABELS[status]}</Badge>;
}

interface IssueStatusActionsProps {
  projectId: string;
  fingerprint: string;
  issue: ErrorIssueState;
}

export function IssueStatusActions({ projectId, fingerprint, issue }: IssueStatusActionsProps) {
  const queryClient = useQueryClient();
  const change = useMutation({
    mutationFn: (status: 'unresolved' | 'resolved' | 'ignored') =>
      api.post<ErrorIssueState>(`/projects/${projectId}/dashboard/errors/${fingerprint}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-errors', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['error-group', projectId, fingerprint] });
    },
  });
  const closed = issue.status === 'resolved' || issue.status === 'ignored';
  const icon = (node: ReactNode) => (change.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : node);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <IssueStatusBadge status={issue.status} />
      {closed ? (
        <Button size="sm" variant="outline" disabled={change.isPending} onClick={() => change.mutate('unresolved')}>
          {icon(<RotateCcw className="mr-2 h-3.5 w-3.5" />)}Reopen
        </Button>
      ) : (
        <>
          <Button size="sm" variant="outline" disabled={change.isPending} onClick={() => change.mutate('resolved')}>
            {icon(<CheckCircle2 className="mr-2 h-3.5 w-3.5" />)}Resolve
          </Button>
          <Button size="sm" variant="outline" disabled={change.isPending} onClick={() => change.mutate('ignored')}>
            {icon(<EyeOff className="mr-2 h-3.5 w-3.5" />)}Ignore
          </Button>
        </>
      )}
      {change.isError && <span className="text-sm text-[#8A1C13]">Could not update the status.</span>}
    </div>
  );
}
