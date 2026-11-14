import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Clock3, ExternalLink, FileSearch, GitBranch, Loader2, Plus, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';
import { TELEMETRY_RANGES, TimeRangeControl, telemetryRangeParams, type TelemetryRange } from '~/components/telemetry/time-range-control';
import { shortId, type ErrorGroupDetail, type FindingResult } from '~/lib/error-groups';

interface ErrorSearch { range: TelemetryRange }

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/errors/$fingerprint')({
  component: ErrorDetail,
  validateSearch: (search: Record<string, unknown>): ErrorSearch => ({
    range: TELEMETRY_RANGES.some((item) => item.value === search.range) ? (search.range as TelemetryRange) : '24h',
  }),
});

interface LogEntry { id: string; timestamp: string; level: string; message: string; }

function ErrorDetail() {
  const { organizationSlug, projectSlug, fingerprint } = Route.useParams();
  const { range } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { projectId } = useProject();
  const queryClient = useQueryClient();
  const rangeQuery = new URLSearchParams(telemetryRangeParams(range)).toString();

  const { data: group, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['error-group', projectId, fingerprint, range],
    queryFn: () => api.get<ErrorGroupDetail>(`/projects/${projectId}/dashboard/errors/${fingerprint}?${rangeQuery}`),
    enabled: !!projectId,
    retry: false,
  });

  const [selected, setSelected] = useState<string | null>(null);
  const occurrence = group?.occurrences.find((item) => item.id === selected) ?? group?.occurrences[0];
  const traceId = occurrence?.traceId ?? '';

  const logs = useQuery({
    queryKey: ['error-logs', projectId, traceId],
    queryFn: () => api.get<{ data: LogEntry[] }>(`/projects/${projectId}/logs?traceId=${encodeURIComponent(traceId)}&limit=50`),
    enabled: !!projectId && !!traceId,
  });

  const createFinding = useMutation({
    mutationFn: () => api.post<FindingResult>(`/projects/${projectId}/dashboard/errors/${fingerprint}/finding?${rangeQuery}`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['detections', projectId] }),
  });

  const back = (
    <Link to="/$organizationSlug/p/$projectSlug/errors" params={{ organizationSlug, projectSlug }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />Back to errors
    </Link>
  );

  if (!projectId) return <Card><CardContent className="p-10 text-center">Choose a project</CardContent></Card>;
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>;
  if (isError) {
    const missing = error instanceof Error && /not found|404/i.test(error.message);
    if (!missing) return <QueryErrorState onRetry={() => void refetch()} />;
    return (
      <div className="space-y-4">
        {back}
        <Card><CardContent className="space-y-3 p-10 text-center">
          <p className="font-medium">No occurrences in this time range</p>
          <p className="text-sm text-muted-foreground">Try a wider range.</p>
          <div className="flex justify-center"><TimeRangeControl value={range} onChange={(value) => void navigate({ search: { range: value } })} /></div>
        </CardContent></Card>
      </div>
    );
  }
  if (!group) return null;

  const peak = Math.max(1, ...group.timeline.map((bucket) => bucket.count));
  const stack = occurrence?.stackTrace || group.exception;

  return (
    <div className="min-h-full space-y-5 pb-8">
      {back}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#FDE8E6]"><AlertCircle className="h-4 w-4 text-[#8A1C13]" /></div>
          <Badge variant="outline">{group.errorType}</Badge>
          <Badge variant="outline">{group.level}</Badge>
          <span className="text-sm font-medium">{group.service}</span>
        </div>
        <h1 className="break-words font-mono text-xl font-semibold">{group.errorMessage}</h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>{group.count.toLocaleString()} occurrences</span>
          <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" />{group.traceCount.toLocaleString()} traces</span>
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />First seen {new Date(group.firstSeen).toLocaleString()}</span>
          <span>Last seen {new Date(group.lastSeen).toLocaleString()}</span>
          <span className="font-mono">ID {group.fingerprint}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={createFinding.isPending} onClick={() => createFinding.mutate()}>
            {createFinding.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}Create finding
          </Button>
          {createFinding.isSuccess && (
            <Link to="/$organizationSlug/p/$projectSlug/intelligence/findings" params={{ organizationSlug, projectSlug }}>
              <Button size="sm" variant="outline"><FileSearch className="mr-2 h-3.5 w-3.5" />{createFinding.data.status === 'created' ? 'Finding created' : 'Finding updated'}: open findings</Button>
            </Link>
          )}
          {createFinding.isError && <span className="text-sm text-[#8A1C13]">{createFinding.error instanceof Error ? createFinding.error.message : 'Could not create finding.'}</span>}
          <div className="ml-auto"><TimeRangeControl value={range} onChange={(value) => void navigate({ search: { range: value } })} /></div>
        </div>
      </header>

      <Card className="border-border shadow-none">
        <CardContent className="p-5">
          <p className="mb-3 text-sm font-medium">Occurrences over time</p>
          <div className="flex h-28 items-end gap-1">
            {group.timeline.map((bucket) => (
              <div key={bucket.start} className="flex h-full flex-1 items-end" title={`${new Date(bucket.start).toLocaleString()}: ${bucket.count}`}>
                <div className="w-full rounded-t bg-[#F28B82]/70" style={{ height: `${bucket.count ? Math.max(6, (bucket.count / peak) * 100) : 0}%` }} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border shadow-none">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium">Stack trace</p>
            {stack ? <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-5">{stack}</pre> : <p className="text-sm text-muted-foreground">No stack trace was captured for this error.</p>}
          </CardContent>
        </Card>
        <Card className="border-border shadow-none">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-medium"><ScrollText className="h-4 w-4" />Logs in this trace</p>
              {traceId && (
                <Link to="/$organizationSlug/p/$projectSlug/trace/$traceId" params={{ organizationSlug, projectSlug, traceId }} className="inline-flex items-center gap-1 text-xs font-medium text-[#16931F] hover:underline">
                  <ExternalLink className="h-3 w-3" />Open trace {shortId(traceId)}
                </Link>
              )}
            </div>
            {!traceId ? <p className="text-sm text-muted-foreground">This occurrence has no trace ID, so there is nothing to correlate.</p>
              : logs.isLoading ? <Skeleton className="h-32" />
              : !logs.data?.data.length ? <p className="text-sm text-muted-foreground">No logs found for this trace.</p>
              : <ul className="max-h-96 divide-y divide-border overflow-auto text-xs">
                {logs.data.data.map((log) => (
                  <li key={log.id} className="flex gap-3 py-2">
                    <span className="shrink-0 text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <Badge variant="outline">{log.level}</Badge>
                    <span className="break-all font-mono">{log.message}</span>
                  </li>
                ))}
              </ul>}
          </CardContent>
        </Card>
      </section>

      <Card className="border-border shadow-none">
        <CardContent className="p-0">
          <p className="border-b border-border px-5 py-3 text-sm font-medium">Recent occurrences</p>
          <ul className="divide-y divide-border">
            {group.occurrences.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => setSelected(item.id)} className={`flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left text-xs hover:bg-muted ${item.id === occurrence?.id ? 'bg-muted' : ''}`}>
                  <span>{new Date(item.timestamp).toLocaleString()}</span>
                  <span className="font-mono text-muted-foreground">log {shortId(item.id)}</span>
                  <span className="font-mono text-muted-foreground">trace {shortId(item.traceId)}</span>
                  <span className="font-mono text-muted-foreground">span {shortId(item.spanId)}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
