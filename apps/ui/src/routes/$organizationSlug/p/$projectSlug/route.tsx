import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';

interface Project { id: string; name: string; slug: string; }

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug')({
  component: ProjectRoute,
});

function ProjectRoute() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const navigate = useNavigate();
  const { orgId, setProject } = useProject();

  const projects = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!orgId,
  });

  const project = projects.data?.find((item) => item.slug === projectSlug);

  useEffect(() => {
    if (projects.isLoading) return;
    if (!project) {
      void navigate({ to: '/$organizationSlug/dashboard', params: { organizationSlug }, replace: true });
      return;
    }
    setProject(project);
  }, [navigate, organizationSlug, project, projects.isLoading, setProject]);

  if (projects.isLoading || !project) return null;

  return <Outlet />;
}
