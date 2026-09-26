import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Boxes, Network } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/service-map')({ component: ServiceMap });

interface MapData {
  nodes: Array<{ service: string; requests: number }>;
  edges: Array<{ source: string; target: string; requests: number }>;
}

function ServiceMap() {
  const { projectId, orgSlug } = useProject();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['service-map', projectId],
    queryFn: () => api.get<MapData>(`/services/map?projectId=${encodeURIComponent(projectId!)}`),
    enabled: !!projectId,
  });

  if (!projectId) return <Card><CardContent className="p-10 text-center"><p className="font-medium">Choose a project</p><p className="mt-1 text-sm text-muted-foreground">Select a project to inspect service dependencies.</p></CardContent></Card>;
  if (isError) return <QueryErrorState onRetry={() => void refetch()} />;

  return <div className="mx-auto w-full space-y-6 pb-10">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16931F]">Runtime topology</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Service map</h1><p className="mt-1 text-sm text-[#989898]">See the services that actually communicate in your traces and follow the busiest dependency paths.</p></div>
      <Link to="/$organizationSlug/services" params={{ organizationSlug: orgSlug! }} className="text-sm font-medium text-[#16931F] hover:underline">Service inventory</Link>
    </header>

    {isLoading ? <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]"><Skeleton className="h-[560px]" /><Skeleton className="h-[560px]" /></div> :
    !data?.nodes.length ? <Card><CardContent className="p-12 text-center"><Network className="mx-auto h-8 w-8 text-[#16931F]" /><p className="mt-3 font-medium">No service topology yet</p><p className="mt-1 text-sm text-[#989898]">The map is built from parent-child relationships in distributed traces.</p><Link to="/onboarding" className="mt-4 inline-flex text-sm font-medium text-[#16931F] hover:underline">Open setup flow</Link></CardContent></Card> :
    <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
      <Card className="overflow-hidden border-[#242426] bg-[#0B0B0C] shadow-none">
        <CardHeader className="border-b bg-[#151517]"><CardTitle className="flex items-center gap-2 text-base"><Network className="h-4 w-4 text-[#ACFC15]" />Observed architecture</CardTitle></CardHeader>
        <CardContent className="p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.nodes.map((node,index) => <div key={node.service} className="relative rounded-xl border border-[#242426] bg-[#151517] p-4">
            {index < data.nodes.length - 1 && <span className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-3 bg-[#3A3A3C] xl:block" />}
            <div className="flex items-start justify-between gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#0B0B0C]"><Boxes className="h-4 w-4 text-[#ACFC15]" /></span><Badge variant="outline">{node.requests.toLocaleString()} spans</Badge></div>
            <p className="mt-3 truncate text-sm font-semibold">{node.service}</p><p className="mt-1 text-xs text-[#989898]">Observed in distributed traces</p>
          </div>)}</div>
        </CardContent>
      </Card>
      <Card className="overflow-hidden border-[#242426] bg-[#0B0B0C] shadow-none">
        <CardHeader className="border-b bg-[#151517]"><CardTitle className="text-base">Dependencies</CardTitle></CardHeader>
        <CardContent className="p-0">{data.edges.length ? <div className="divide-y divide-[#242426]">{data.edges.map((edge) => <div key={edge.source + edge.target} className="flex items-center gap-3 p-4"><span className="min-w-0 flex-1 truncate text-sm font-medium">{edge.source}</span><ArrowRight className="h-4 w-4 shrink-0 text-[#ACFC15]" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{edge.target}</span><span className="font-mono text-[11px] text-[#989898]">{edge.requests}</span></div>)}</div> : <div className="p-6 text-sm text-[#989898]">No cross-service parent-child relationships were observed in the current trace window.</div>}</CardContent>
      </Card>
    </div>}
  </div>;
}
