import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { Sidebar } from '~/components/sidebar';
import { TopBar } from '~/components/topbar';
import { Toaster } from '~/components/ui/sonner';
import { SidebarProvider } from '~/lib/sidebar-context';

interface Project { id: string; name: string; slug: string; }

export const Route = createFileRoute('/dashboard/projects/$projectSlug')({
  component: ProjectDashboardLayout,
});

function ProjectDashboardLayout() {
  const { projectSlug } = Route.useParams();
  const navigate = useNavigate();
  const { orgId, setProject } = useProject();

  const projects = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!orgId,
  });

  const project = projects.data?.find((item) => item.slug === projectSlug);

  useEffect(() => {
    if (!projects.isLoading && !project) {
      void navigate({ to: '/dashboard' });
      return;
    }
    if (project) setProject(project);
  }, [navigate, project, projects.isLoading, setProject]);

  if (!project) return null;

  return (
    <SidebarProvider>
      <div className="dashboard-shell flex min-h-dvh flex-col bg-[#040405]">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <TopBar />
        <div className="flex min-h-0 w-full flex-1">
          <Sidebar />
          <main id="main-content" tabIndex={-1} className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto bg-[#040405] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
            <div className="mx-auto w-full max-w-[1440px]">
              <Outlet />
            </div>
          </main>
        </div>
        <Toaster />
      </div>
    </SidebarProvider>
  );
}
