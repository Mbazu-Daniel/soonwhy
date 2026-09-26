import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';

interface Project { id: string; name: string; slug: string; }

export const Route = createFileRoute('/dashboard/')({ component: DashboardEntry });

function DashboardEntry() {
  const navigate = useNavigate();
  const { orgId, setProject } = useProject();
  const projects = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!orgId,
  });

  useEffect(() => {
    const project = projects.data?.[0];
    if (project) {
      setProject(project);
      void navigate({ to: '/dashboard/projects/$projectSlug', params: { projectSlug: project.slug }, replace: true });
    }
  }, [navigate, projects.data, setProject]);

  return <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">Loading project…</div>;
}
