import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BrainCircuit, RefreshCw, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { useState } from 'react';

export const Route = createFileRoute('/dashboard/detections')({ component: DetectionOverview });

type FindingType = 'latency' | 'error_rate' | 'throughput' | 'dependency_latency' | 'trace_span' | 'bottleneck';
type Severity = 'warning' | 'critical';
interface DetectionFinding {
  id: string; projectId: string; serviceName: string; type: FindingType; severity: Severity;
  title: string; description: string; observedValue: number; threshold: number; unit: string;
  window: { start: string; end: string };
  evidence: Array<{ kind: string; label: string; value: number | string; context?: Record<string, unknown> }>;
}
interface RcaAnalysis {
  id: string; serviceName: string; severity: Severity; summary: string; rootCause: string;
  contributingFactors: string[]; investigationSteps: string[]; suggestedChanges: string[];
  evidenceRefs: string[]; confidence: 'low' | 'medium' | 'high'; limitations: string[];
  provider: string; model: string; promptVersion: string; createdAt: string;
}

function DetectionOverview() {
  const { projectId } = useProject();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: findings, isLoading } = useQuery({
    queryKey: ['detections', projectId],
    queryFn: () => api.get<DetectionFinding[]>('/projects/' + projectId + '/detections'),
    enabled: !!projectId,
  });
  const selected = findings?.find((item) => item.id === selectedId) ?? findings?.[0];
  const isBottleneck = selected?.type === 'bottleneck';
  const { data: rca, isLoading: rcaLoading } = useQuery({
    queryKey: ['rca', projectId, selected?.id],
    queryFn: () => api.get<RcaAnalysis>('/projects/' + projectId + '/findings/' + selected?.id + '/rca'),
    enabled: !!projectId && !!selected?.id && isBottleneck, retry: false,
  });
  const { data: history } = useQuery({
    queryKey: ['rca-history', projectId, selected?.id],
    queryFn: () => api.get<RcaAnalysis[]>('/projects/' + projectId + '/findings/' + selected?.id + '/rca/history'),
    enabled: !!projectId && !!selected?.id && isBottleneck,
  });
  const generate = useMutation({
    mutationFn: (regenerate: boolean) => api.post<RcaAnalysis>('/projects/' + projectId + '/findings/' + selected?.id + '/rca', { regenerate }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rca', projectId, selected?.id] });
      void queryClient.invalidateQueries({ queryKey: ['rca-history', projectId, selected?.id] });
    },
  });

  if (!projectId) return <Card><CardContent className="p-8 text-center text-muted-foreground">Select a project to view detections.</CardContent></Card>;
  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold">Detections</h2><p className="text-sm text-muted-foreground mt-1">Review deterministic findings and inspect grounded RCA for correlated bottlenecks.</p></div>
      {isLoading ? <div className="grid gap-4 lg:grid-cols-[360px_1fr]"><Skeleton className="h-[520px]" /><Skeleton className="h-[520px]" /></div> : !findings?.length ?
        <Card><CardContent className="p-8 text-center text-muted-foreground">No detections found. Run detection from the API to create findings.</CardContent></Card> :
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card className="overflow-hidden"><CardHeader className="border-b"><CardTitle className="text-base">Findings</CardTitle><CardDescription>{findings.length} recent finding{findings.length === 1 ? '' : 's'}</CardDescription></CardHeader>
            <CardContent className="p-0"><div className="divide-y">
              {findings.map((finding) => <button key={finding.id} type="button" onClick={() => setSelectedId(finding.id)} className={'w-full text-left p-4 transition-colors hover:bg-muted/50 ' + (selected?.id === finding.id ? 'bg-muted' : '')}>
                <div className="flex items-start gap-3"><SeverityIcon severity={finding.severity} /><div className="min-w-0 flex-1"><p className="font-medium text-sm truncate">{finding.title}</p><p className="text-xs text-muted-foreground mt-1">{finding.serviceName} · {finding.type}</p><p className="text-xs text-muted-foreground mt-1">{new Date(finding.window.end).toLocaleString()}</p></div><ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" /></div>
              </button>)}
            </div></CardContent>
          </Card>
          {selected && <Card><CardHeader className="border-b"><div className="flex items-start justify-between gap-4"><div><CardTitle className="text-lg">{selected.title}</CardTitle><CardDescription className="mt-1">{selected.serviceName} · {selected.severity} · {selected.observedValue}{selected.unit}</CardDescription></div>{isBottleneck && <Button size="sm" variant="outline" onClick={() => generate.mutate(true)} disabled={generate.isPending}><RefreshCw className={generate.isPending ? 'animate-spin' : ''} />Regenerate</Button>}</div></CardHeader>
            <CardContent className="p-6 space-y-6"><section><h3 className="font-medium">Detection evidence</h3><p className="text-sm text-muted-foreground mt-2">{selected.description}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{selected.evidence.map((item, index) => <div key={item.label + index} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{item.label}</p><p className="text-sm font-medium mt-1 break-words">{String(item.value)}</p></div>)}</div></section>
            {isBottleneck && <section className="border-t pt-6"><div className="flex items-center justify-between gap-4"><div><h3 className="font-medium flex items-center gap-2"><BrainCircuit className="h-4 w-4" />AI RCA</h3><p className="text-xs text-muted-foreground mt-1">AI explanations are grounded in deterministic evidence.</p></div>{!rca && !rcaLoading && <Button onClick={() => generate.mutate(false)} disabled={generate.isPending}><BrainCircuit />Generate RCA</Button>}</div>
              {rcaLoading ? <div className="mt-4 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-32" /></div> : rca ? <RcaContent rca={rca} history={history ?? []} /> : <div className="mt-4 rounded-md border border-dashed p-6 text-sm text-muted-foreground">No RCA has been generated for this finding yet.</div>}
              {generate.isError && <p className="mt-3 text-sm text-destructive">{generate.error instanceof Error ? generate.error.message : 'RCA generation failed.'}</p>}
            </section>}</CardContent></Card>}
        </div>}
    </div>
  );
}

function RcaContent({ rca, history }: { rca: RcaAnalysis; history: RcaAnalysis[] }) {
  return <div className="mt-4 space-y-5"><div className="rounded-md border p-4"><div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span>Confidence: <strong className="text-foreground">{rca.confidence}</strong></span><span>Model: {rca.model}</span><span>Prompt: {rca.promptVersion}</span><span>{new Date(rca.createdAt).toLocaleString()}</span></div><p className="mt-3 text-sm">{rca.summary}</p></div>
    <RcaList title="Root cause" items={[rca.rootCause]} /><RcaList title="Contributing factors" items={rca.contributingFactors} /><RcaList title="Investigation steps" items={rca.investigationSteps} /><RcaList title="Suggested changes" items={rca.suggestedChanges} /><RcaList title="Limitations" items={rca.limitations} />
    {history.length > 1 && <p className="text-xs text-muted-foreground">RCA history: {history.length} analyses for this finding.</p>}</div>;
}
function RcaList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return <div><h4 className="text-sm font-medium">{title}</h4><ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">{items.map((item, index) => <li key={title + index}>{item}</li>)}</ul></div>;
}
function SeverityIcon({ severity }: { severity: Severity }) { return severity === 'critical' ? <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" /> : <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />; }