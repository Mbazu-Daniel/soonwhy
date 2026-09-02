import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '~/components/ui/table';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/dashboard/services')({
  component: ServiceOverview,
});

interface Service {
  service: string;
  requestCount: number;
  errorCount: number;
  avgLatency: number;
}

function ServiceOverview() {
  const { projectId } = useProject();

  const { data: services, isLoading } = useQuery({
    queryKey: ['dashboard-services', projectId],
    queryFn: () => api.get<Service[]>(`/dashboard/services?projectId=${projectId}`),
    enabled: !!projectId,
  });

  if (!projectId) {
    return <div className="space-y-6"><h2 className="text-2xl font-bold">Services</h2><Card><CardContent className="p-8 text-center text-muted-foreground">Select a project</CardContent></Card></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Services</h2>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead className="text-right">Error Rate</TableHead>
                <TableHead className="text-right">Avg Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-9" /></TableCell></TableRow>
                ))
              ) : !services || services.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No services found</TableCell></TableRow>
              ) : (
                services.map((s) => {
                  const errorRate = s.requestCount > 0 ? Math.round((s.errorCount / s.requestCount) * 10000) / 100 : 0;
                  return (
                    <TableRow key={s.service}>
                      <TableCell className="font-medium">{s.service}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{s.requestCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{s.errorCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{errorRate}%</TableCell>
                      <TableCell className="text-right font-mono text-sm">{Math.round(s.avgLatency)}ms</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
