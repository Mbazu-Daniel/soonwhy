import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Clock3, Layers3 } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { Badge } from '~/components/ui/badge';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/dashboard/projects/$projectSlug/errors')({ component: ErrorOverview });
interface ErrorEntry { fingerprint: string; errorMessage: string; errorType: string; service: string; count: number; lastSeen: string; }

function ErrorOverview() {
  const { projectSlug, orgSlug } = useProject();
  const { projectId } = useProject();
  const { data: errors, isLoading, isError, refetch } = useQuery({ queryKey: ['dashboard-errors', projectId], queryFn: () => api.get<ErrorEntry[]>(`/projects/${projectId}/dashboard/errors`), enabled: !!projectId });
  const totalErrors = errors?.reduce((sum, error) => sum + error.count, 0) ?? 0;
  if (!projectId) return <EmptyProject />;
  if (isError) return <QueryErrorState onRetry={() => void refetch()} />;
  return <div className="min-h-full space-y-5 pb-8">
    <header><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#16931F]">Failure signals</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Errors</h1><p className="mt-1 text-sm text-muted-foreground">Grouped application failures, frequency and the services affected.</p></header>
    <div className="grid grid-cols-2 gap-4"><Stat icon={AlertCircle} label="Occurrences · 24h" value={isLoading ? '—' : totalErrors.toLocaleString()} critical /><Stat icon={Layers3} label="Unique fingerprints" value={isLoading ? '—' : (errors?.length ?? 0).toLocaleString()} /></div>
    <Card className="overflow-hidden border-border bg-card shadow-none"><div className="border-b bg-muted px-5 py-4"><p className="text-sm font-semibold">Error groups</p><p className="mt-1 text-xs text-muted-foreground">One row represents a fingerprinted error group.</p></div><CardContent className="p-0">
      {isLoading ? <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div> : !errors?.length ? <div className="p-12 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-secondary"><AlertCircle className="h-5 w-5" /></div><p className="mt-3 font-medium">No errors found</p><p className="mt-1 text-sm text-muted-foreground">There are no grouped failures in the current project snapshot.</p></div> : <div className="divide-y divide-[#DBE5D7]">{errors.map((error) => <article key={error.fingerprint} className="p-5 transition-colors hover:bg-muted">
        <div className="flex items-start gap-4"><div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FDE8E6]"><AlertCircle className="h-4 w-4 text-[#8A1C13]" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-mono text-sm font-medium">{error.errorMessage}</h2><Badge variant="outline">{error.errorType}</Badge></div><div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="font-medium text-[#182012]">{error.service}</span><span>{error.count.toLocaleString()} occurrences</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />Last seen {new Date(error.lastSeen).toLocaleString()}</span></div></div></div>
      </article>)}</div>}
    </CardContent></Card>
  </div>;
}
function Stat({ icon: Icon, label, value, critical }: { icon: typeof AlertCircle; label: string; value: string; critical?: boolean }) { return <Card className="border-border bg-card shadow-none"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon className={`h-4 w-4 ${critical ? 'text-[#8A1C13]' : 'text-[#16931F]'}`} /></div><p className={`mt-2 text-xl font-semibold tracking-tight ${critical ? 'text-[#8A1C13]' : ''}`}>{value}</p></CardContent></Card>; }
function EmptyProject() { return <Card><CardContent className="p-10 text-center"><p className="font-medium">Choose a project</p><p className="mt-1 text-sm text-muted-foreground">Select a project from the top bar to inspect errors.</p></CardContent></Card>; }
