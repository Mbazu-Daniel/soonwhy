import { BrainCircuit, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { RcaContent, type RcaAnalysis } from '~/components/ai/rca-content';
import { RcaGenerationError } from '~/components/ai/rca-generation-error';
import { api } from '~/lib/api';
import type { FindingResult } from '~/lib/error-groups';

interface ErrorAnalysisProps {
  projectId: string;
  organizationSlug: string;
  fingerprint: string;
  rangeQuery: string;
  findingId: string | null;
}

export function ErrorAnalysis({ projectId, organizationSlug, fingerprint, rangeQuery, findingId }: ErrorAnalysisProps) {
  const queryClient = useQueryClient();
  const key = ['error-rca', projectId, findingId];
  const existing = useQuery({
    queryKey: key,
    queryFn: () => api.get<RcaAnalysis>(`/projects/${projectId}/findings/${findingId}/rca`),
    enabled: !!findingId,
    retry: false,
  });
  const analyze = useMutation({
    mutationFn: async (regenerate: boolean) => {
      const finding = await api.post<FindingResult>(`/projects/${projectId}/dashboard/errors/${fingerprint}/finding?${rangeQuery}`, {});
      const rca = await api.post<RcaAnalysis>(`/projects/${projectId}/findings/${finding.finding.id}/rca`, { regenerate });
      return { rca, findingId: finding.finding.id };
    },
    onSuccess: ({ rca, findingId: id }) => {
      queryClient.setQueryData(['error-rca', projectId, id], rca);
      void queryClient.invalidateQueries({ queryKey: ['detections', projectId] });
    },
  });

  const rca = analyze.data?.rca ?? existing.data;
  return (
    <Card className="border-border shadow-none">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium"><BrainCircuit className="h-4 w-4" />Root cause analysis</p>
          <Button size="sm" variant="outline" disabled={analyze.isPending} onClick={() => analyze.mutate(!!rca)}>
            {analyze.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="mr-2 h-3.5 w-3.5" />}
            {rca ? 'Re-analyze' : 'Analyze with AI'}
          </Button>
        </div>
        {!rca && !analyze.isPending && <p className="text-sm text-muted-foreground">Uses the stack frames, cause chain and trace to propose a root cause and fix candidates.</p>}
        {analyze.isPending && <p className="text-xs text-muted-foreground">Analyzing, this can take up to a minute…</p>}
        {rca && <RcaContent rca={rca} history={[]} />}
        {analyze.data?.rca.quotaWarning && <p className="text-xs text-[#713F12]">This run went over the AI usage allowance for this organisation.</p>}
        {analyze.isError && <RcaGenerationError error={analyze.error} orgSlug={organizationSlug} />}
      </CardContent>
    </Card>
  );
}
