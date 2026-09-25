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
  id: string;
  name: string;
  slug: string;
  language: string | null;
  framework: string | null;
  repositoryUrl: string | null;
  repositoryProvider: string | null;
  repositoryBranch: string | null;
  owner: { id: string; name: string | null; email: string } | null;
  team: { id: string; name: string; slug: string } | null;
}

function ServiceOverview() {
  const { projectId } = useProject();

  const { data: services, isLoading } = useQuery({
    queryKey: ['services', projectId],
    queryFn: () => api.get<Service[]>(`/services?projectId=${projectId}`),
    enabled: !!projectId,
  });

  if (!projectId) {
    return <div className="space-y-6"><h2 className="text-2xl font-bold">Services</h2><Card><CardContent className="p-8 text-center text-muted-foreground">Select a project</CardContent></Card></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Services</h2>
        <p className="text-sm text-muted-foreground">Application services and their ownership context.</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Runtime</TableHead>
                <TableHead>Repository</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Team</TableHead>
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
                services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div className="font-medium">{service.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{service.slug}</div>
                    </TableCell>
                    <TableCell>
                      <div>{service.language ?? 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{service.framework ?? 'Framework not set'}</div>
                    </TableCell>
                    <TableCell>
                      {service.repositoryUrl ? (
                        <a className="text-sm underline underline-offset-4" href={service.repositoryUrl} target="_blank" rel="noreferrer">
                          {service.repositoryProvider ?? 'Repository'}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not linked</span>
                      )}
                      {service.repositoryBranch && <div className="font-mono text-xs text-muted-foreground">{service.repositoryBranch}</div>}
                    </TableCell>
                    <TableCell>{service.owner?.name ?? service.owner?.email ?? 'Unassigned'}</TableCell>
                    <TableCell>{service.team?.name ?? 'Unassigned'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
