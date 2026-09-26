import { createFileRoute } from '@tanstack/react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock3, FileSearch, Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';
import { TimeRangeControl, telemetryRangeParams, type TelemetryRange } from '~/components/telemetry/time-range-control';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/errors')({ component: ProjectErrors });

interface ErrorEntry { fingerprint: string; errorMessage: string; errorType: string; service: string; count: number; lastSeen: string; }

function ProjectErrors() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { projectId } = useProject();
  const [range, setRange] = useState<TelemetryRange>('24h');
  const rangeQuery = new URLSearchParams(telemetryRangeParams(range)).toString();
  const queryClient = useQueryClient();
  const [selectedFingerprint, setSelectedFingerprint] = useState<string | null>(null);
  const { data: errors, isLoading, isError, refetch } = useQuery({
    queryKey: ['project-errors', projectId, range],
    queryFn: () => api.get<ErrorEntry[]>(`/projects/${projectId}/dashboard/errors?${rangeQuery}`),
    enabled: !!projectId,
    placeholderData: keepPreviousData,
  });
  const createFinding = useMutation({
    mutationFn: (error: ErrorEntry) => api.post(`/projects/${projectId}/detections/from-error`, { fingerprint: error.fingerprint, service: error.service }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['detections', projectId] }),
  });

  if (!projectId) return <Card><CardContent className="p-10 text-center"><p className="font-medium">Choose a project</p></CardContent></Card>;
  if (isError && !errors) return <QueryErrorState onRetry={() => void refetch()} />;

  return <div className="mx-auto w-full space-y-6 pb-10">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#16931F]">Failure signals</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Errors</h1><p className="mt-1 text-sm text-[#989898]">Grouped application failures, frequency and the services affected.</p></div><TimeRangeControl value={range} onChange={setRange}/></header>
    {isError && errors && <div className="rounded-xl border border-[#5A4A1C] bg-[#2A220F] px-4 py-3 text-xs text-[#D8C68A]">Showing the last successful error data. <button type="button" className="font-medium underline" onClick={() => void refetch()}>Retry</button></div>}
    <Card className="overflow-hidden border-[#242426] bg-[#0B0B0C] shadow-none"><div className="border-b bg-[#151517] px-5 py-4"><p className="text-sm font-semibold">Error groups</p><p className="mt-1 text-xs text-[#989898]">Create a finding from a concrete error group to carry its evidence into Investigations.</p></div><CardContent className="p-0">
      {isLoading && !errors ? <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div> : !errors?.length ? <div className="p-12 text-center"><AlertCircle className="mx-auto h-8 w-8 text-[#16931F]"/><p className="mt-3 font-medium">No errors found</p><p className="mt-1 text-sm text-[#989898]">There are no grouped failures in the selected time range.</p></div> : <div className="divide-y divide-[#DBE5D7]">{errors.map(error => {
        const creating = createFinding.isPending && selectedFingerprint === error.fingerprint;
        return <article key={error.fingerprint} className="p-5 transition-colors hover:bg-[#151517]"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-start gap-4"><div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FDE8E6]"><AlertCircle className="h-4 w-4 text-[#8A1C13]"/></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-mono text-sm font-medium">{error.errorMessage}</h2><Badge variant="outline">{error.errorType}</Badge></div><div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#989898]"><span className="font-medium text-[#182012]">{error.service}</span><span>{error.count.toLocaleString()} occurrences</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3"/>Last seen {new Date(error.lastSeen).toLocaleString()}</span></div></div></div><Button size="sm" variant="outline" disabled={createFinding.isPending} onClick={() => { setSelectedFingerprint(error.fingerprint); createFinding.mutate(error); }}>{creating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/> : <Plus className="mr-2 h-3.5 w-3.5"/>}Create finding</Button></div></article>;
      })}</div>}
    </CardContent></Card>
    {createFinding.isSuccess && <div className="flex items-center justify-between rounded-xl border border-[#DBE5D7] bg-secondary px-4 py-3 text-sm"><span>Finding created from the selected error group.</span><Link to="/$organizationSlug/p/$projectSlug/detections" params={{ organizationSlug, projectSlug }} className="inline-flex items-center gap-2 font-medium text-[#16931F] hover:underline"><FileSearch className="h-4 w-4"/>View findings</Link></div>}
    {createFinding.isError && <p className="text-sm text-[#8A1C13]">{createFinding.error instanceof Error ? createFinding.error.message : 'Could not create finding.'}</p>}
  </div>;
}
