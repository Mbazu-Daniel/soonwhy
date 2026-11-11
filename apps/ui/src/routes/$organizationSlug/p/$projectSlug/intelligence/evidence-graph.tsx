import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Network, GitBranch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/intelligence/evidence-graph')({ component: EvidenceGraph });

interface GraphStats { nodes: number; edges: number; services: number; traces: number; }

function EvidenceGraph() {
  const { projectId } = useProject();
  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ['evidence-graph-stats', projectId],
    queryFn: () => api.get<GraphStats>(`/projects/${projectId}/evidence-graph/stats`),
    enabled: !!projectId,
  });

  if (!projectId) return <Card><CardContent className="p-12 text-center">Choose a project</CardContent></Card>;
  if (isError) return <QueryErrorState onRetry={() => void refetch()} />;

  return (
    <div className="space-y-5">
      <Card className="border-border shadow-none">
        <CardHeader className="border-b bg-muted">
          <CardTitle className="text-base">Evidence Graph</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="grid gap-4 lg:grid-cols-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-4">
              <StatCard label="Nodes" value={stats?.nodes ?? 0} icon={Network} />
              <StatCard label="Edges" value={stats?.edges ?? 0} icon={GitBranch} />
              <StatCard label="Services" value={stats?.services ?? 0} icon={Network} />
              <StatCard label="Traces" value={stats?.traces ?? 0} icon={GitBranch} />
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="border-border shadow-none">
        <CardContent className="p-12 text-center">
          <Network className="mx-auto h-8 w-8 text-[#16931F]" />
          <p className="mt-3 font-medium">Graph visualization coming soon</p>
          <p className="mt-1 text-sm text-muted-foreground">The evidence graph stores correlations between telemetry events.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Network }) {
  return (
    <div className="rounded-lg border border-border bg-muted p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#16931F]" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}
