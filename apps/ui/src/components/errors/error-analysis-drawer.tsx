import { useState } from 'react';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { FindingDrawer } from '~/components/findings/finding-drawer';
import { api } from '~/lib/api';
import type { FindingResult } from '~/lib/error-groups';
import type { DetectionFinding } from '~/lib/findings.types';

interface ErrorAnalysisDrawerProps {
  projectId: string;
  organizationSlug: string;
  fingerprint: string;
  rangeQuery: string;
  findingId: string | null;
}

export function ErrorAnalysisDrawer({ projectId, organizationSlug, fingerprint, rangeQuery, findingId }: ErrorAnalysisDrawerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const activeId = findingId ?? createdId;

  const create = useMutation({
    mutationFn: () => api.post<FindingResult>(`/projects/${projectId}/dashboard/errors/${fingerprint}/finding?${rangeQuery}`, {}),
    onSuccess: (result) => {
      setCreatedId(result.finding.id);
      void queryClient.invalidateQueries({ queryKey: ['detections', projectId] });
    },
  });

  const findings = useQuery({
    queryKey: ['detections', projectId],
    queryFn: () => api.get<DetectionFinding[]>(`/projects/${projectId}/detections`),
    enabled: open && !!activeId,
  });

  const finding = findings.data?.find((item) => item.id === activeId) ?? null;

  const openDrawer = () => {
    setOpen(true);
    if (!activeId && !create.isPending) create.mutate();
  };

  const busy = create.isPending || (open && !!activeId && findings.isLoading);

  return (
    <>
      <Button size="sm" variant="outline" disabled={busy} onClick={openDrawer}>
        {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="mr-2 h-3.5 w-3.5" />}
        {activeId ? 'View analysis' : 'Analyze with AI'}
      </Button>
      {create.isError && <span className="text-sm text-[#8A1C13]">{create.error instanceof Error ? create.error.message : 'Could not start the analysis.'}</span>}
      {findings.isError && open && <span className="text-sm text-[#8A1C13]">Could not load the finding.</span>}
      <FindingDrawer finding={open ? finding : null} projectId={projectId} organizationSlug={organizationSlug} onClose={() => setOpen(false)} />
    </>
  );
}
