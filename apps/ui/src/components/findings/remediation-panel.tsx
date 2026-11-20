import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { ProviderSwitch } from '~/components/ai/provider-switch';
import { RcaGenerationError } from '~/components/ai/rca-generation-error';
import type { RcaAnalysis } from '~/lib/rca.types';
import { api } from '~/lib/api';
import { isRcaSupported } from '~/lib/rca-support';
import { splitEvidence } from '~/lib/findings';
import type { DetectionFinding } from '~/lib/findings.types';

export function RemediationPanel({
  projectId,
  finding,
  organizationSlug,
}: {
  projectId: string;
  finding: DetectionFinding;
  organizationSlug: string;
}) {
  const queryClient = useQueryClient();
  const [credentialId, setCredentialId] = useState('');
  const supported = isRcaSupported(finding.type);
  const key = ['rca', projectId, finding.id];

  const existing = useQuery({
    queryKey: key,
    queryFn: () => api.get<RcaAnalysis>(`/projects/${projectId}/findings/${finding.id}/rca`),
    enabled: supported,
    retry: false,
  });
  const generate = useMutation({
    mutationFn: (regenerate: boolean) =>
      api.post<RcaAnalysis>(`/projects/${projectId}/findings/${finding.id}/rca`, {
        regenerate,
        ...(credentialId ? { credentialId } : {}),
      }),
    onSuccess: (rca) => {
      queryClient.setQueryData(key, rca);
      void queryClient.invalidateQueries({ queryKey: ['rca-history', projectId, finding.id] });
    },
  });

  const rca = generate.data ?? existing.data;
  const { recommendations } = splitEvidence(finding);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-[#16931F]" />
          AI Suggested Remediation
        </h2>
        {supported && (
          <div className="flex items-center gap-2">
            <ProviderSwitch value={credentialId} onChange={setCredentialId} className="max-w-[10rem]" />
            <Button size="sm" variant="outline" disabled={generate.isPending} onClick={() => generate.mutate(!!rca)}>
              {generate.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {rca ? 'Regenerate' : 'Generate'}
            </Button>
          </div>
        )}
      </div>

      {supported && existing.isLoading && (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-24" />
        </div>
      )}

      {rca && (
        <div className="mt-4 space-y-4 text-sm leading-6">
          <p>{rca.summary}</p>
          {rca.rootCause && (
            <div className="flex gap-2 rounded-lg border border-[#FDE68A] bg-[#FEF9E7] p-3 text-[#713F12]">
              <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
              <p>
                <strong>Impact:</strong> {rca.rootCause}
              </p>
            </div>
          )}
          <Steps title="Recommended fix" items={rca.suggestedChanges} />
          <Steps title="How to confirm" items={rca.investigationSteps} />
          <Steps title="Limits of this analysis" items={rca.limitations} muted />
          <p className="text-xs text-muted-foreground">
            Confidence {rca.confidence} · {rca.model} · {new Date(rca.createdAt).toLocaleString()}
          </p>
        </div>
      )}

      {!rca && !existing.isLoading && supported && !generate.isPending && (
        <p className="mt-4 text-sm text-muted-foreground">
          No analysis yet. Generate one to get the likely cause and a fix, based on this finding's evidence.
        </p>
      )}
      {generate.isPending && <p className="mt-4 text-xs text-muted-foreground">Analyzing, this can take up to a minute…</p>}
      {generate.data?.quotaWarning && (
        <p className="mt-3 text-xs text-[#713F12]">This run went over the AI usage allowance for this organisation.</p>
      )}
      {generate.isError && <RcaGenerationError error={generate.error} orgSlug={organizationSlug} />}

      {!supported && (
        <div className="mt-4 space-y-2 text-sm">
          {recommendations.length === 0 ? (
            <p className="text-muted-foreground">No remediation is available for this kind of finding yet.</p>
          ) : (
            recommendations.map((item, index) => (
              <p key={index} className="rounded-lg border border-border bg-muted p-3 leading-6">
                {String(item.value)}
              </p>
            ))
          )}
        </div>
      )}
    </section>
  );
}

function Steps({ title, items, muted = false }: { title: string; items: string[]; muted?: boolean }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className={`mt-2 space-y-2 ${muted ? 'text-muted-foreground' : ''}`}>
        {items.map((item, index) => (
          <li key={index} className="border-l-2 border-[#8BD125] pl-3">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
