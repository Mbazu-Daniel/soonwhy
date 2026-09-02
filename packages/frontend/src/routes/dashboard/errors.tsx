import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';

export const Route = createFileRoute('/dashboard/errors')({
  component: ErrorOverview,
});

interface ErrorEntry {
  fingerprint: string;
  errorMessage: string;
  errorType: string;
  service: string;
  count: number;
  lastSeen: string;
}

function getProjectId(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('project_id') : null;
}

function ErrorOverview() {
  const projectId = getProjectId();

  const { data: errors, isLoading } = useQuery({
    queryKey: ['dashboard-errors', projectId],
    queryFn: () => api.get<ErrorEntry[]>(`/dashboard/errors?projectId=${projectId}`),
    enabled: !!projectId,
  });

  const totalErrors = errors?.reduce((sum, e) => sum + e.count, 0) ?? 0;

  if (!projectId) {
    return <div className="space-y-6"><h2 className="text-2xl font-bold">Errors</h2><Card><CardContent className="p-8 text-center text-muted-foreground">Select a project</CardContent></Card></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Errors</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Errors (24h)</p><p className="text-2xl font-bold mt-1">{isLoading ? '—' : totalErrors.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Unique Errors</p><p className="text-2xl font-bold mt-1">{isLoading ? '—' : (errors?.length ?? 0)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : !errors || errors.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No errors found</div>
          ) : (
            <div className="divide-y">
              {errors.map((error) => (
                <div key={error.fingerprint} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm truncate">{error.errorMessage}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{error.service}</span>
                        <span>{error.count} occurrences</span>
                        <span>Last: {new Date(error.lastSeen).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
