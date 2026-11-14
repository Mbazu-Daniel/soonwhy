import { createFileRoute, Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '~/components/sidebar';
import { Menu, AlertTriangle } from 'lucide-react';
import { Toaster } from '~/components/ui/sonner';
import { Skeleton } from '~/components/ui/skeleton';
import { SidebarProvider, useSidebar } from '~/lib/sidebar-context';
import { getSessionToken, clearSession } from '~/lib/auth-client';
import { useProject } from '~/lib/project-context';
import { api } from '~/lib/api';
import { CreateProjectDialog } from '~/components/create-project-dialog';
import { Button } from '~/components/ui/button';

interface Organization { id: string; name: string; slug: string; }
interface Project { id: string; name: string; slug: string; }

const ORGANIZATION_PAGES = new Set(['ai', 'settings']);
const PROJECT_PAGE_ALIASES = new Set(['services', 'errors', 'logs', 'traces', 'api-keys', 'alerts', 'metrics', 'intelligence']);
export const Route = createFileRoute('/$organizationSlug')({ component: OrganizationDashboardLayout });

function OrganizationDashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { organizationSlug } = Route.useParams();
  const { orgId, projectId, setOrganization, setProject } = useProject();
  const token = getSessionToken();

  const session = useQuery({ queryKey: ['session'], queryFn: () => api.get<{ user: { id: string } }>('/auth/session'), enabled: !!token, retry: false });
  const organizations = useQuery({ queryKey: ['organizations'], queryFn: () => api.get<Organization[]>('/organizations'), enabled: !!token && !!session.data, retry: false });
  const organization = organizations.data?.find((item) => item.slug === organizationSlug);
  const projects = useQuery({ queryKey: ['projects', orgId], queryFn: () => api.get<Project[]>('/projects'), enabled: !!orgId && orgId === organization?.id });

  const isProjectRoute = location.pathname.includes('/p/');
  const projectRouteSlug = isProjectRoute ? location.pathname.split('/p/')[1]?.split('/')[0] : null;
  const activeProject = projects.data?.find((project) => project.slug === projectRouteSlug) ?? projects.data?.find((project) => project.id === projectId) ?? projects.data?.[0];

  useEffect(() => {
    if (session.isLoading || organizations.isLoading) return;
    if (!token || !session.data) { clearSession(); void navigate({ to: '/login', replace: true }); return; }
    if (!organization) { if (organizations.data) void navigate({ to: '/organizations', replace: true }); return; }
    setOrganization({ id: organization.id, slug: organization.slug });
  }, [token, session.isLoading, session.data, organizations.isLoading, organizations.data, organization, navigate, setOrganization]);

  useEffect(() => {
    if (!organization || !projects.data) return;
    if (isProjectRoute) { if (activeProject && projectId !== activeProject.id) setProject(activeProject); return; }
    if (!projects.data.length || !activeProject) return;
    const segment = location.pathname.slice(`/${organizationSlug}`.length).replace(/^\//, '');
    const [page, param] = segment.split('/');
    if (ORGANIZATION_PAGES.has(page ?? '')) return;
    if ((page === 'service' || page === 'trace') && param) {
      void navigate({ to: `/${organizationSlug}/p/${activeProject.slug}/${page}/${param}` as never, replace: true });
      return;
    }
    const suffix = PROJECT_PAGE_ALIASES.has(page ?? '') ? page : '';
    const target = suffix ? `/${organizationSlug}/p/${activeProject.slug}/${suffix}` : `/${organizationSlug}/p/${activeProject.slug}/`;
    void navigate({ to: target as never, replace: true });
  }, [activeProject, isProjectRoute, location.pathname, navigate, organization, organizationSlug, projectId, projects.data, setProject]);

  const showCreateProject = !!organization && !projects.isLoading && projects.data?.length === 0;

  if (session.isError || organizations.isError) {
    return <DashboardUnavailable onRetry={() => { void session.refetch(); void organizations.refetch(); }} />;
  }

  if (session.isLoading || organizations.isLoading || !token || !session.data || !organization || orgId !== organization.id) return <DashboardLoading />;

  return <SidebarProvider><OrganizationDashboardFrame showCreateProject={showCreateProject} /></SidebarProvider>;
}

function OrganizationDashboardFrame({ showCreateProject }: { showCreateProject: boolean }) {
  const { pathname } = useLocation();
  const { toggle } = useSidebar();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [pathname]);

  return (
    <div className="dashboard-shell flex h-dvh flex-col overflow-hidden bg-[#040405]">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <button type="button" onClick={toggle} aria-label="Open sidebar" className="fixed left-3 top-3 z-40 grid h-10 w-10 place-items-center rounded-lg border border-[#242426] bg-[#151517] text-[#989898] hover:text-[#F6F6F6] lg:hidden">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex min-h-0 w-full flex-1">
        <Sidebar />
        <main ref={mainRef} id="main-content" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#040405] px-4 pb-5 pt-16 sm:px-6 sm:pb-7 lg:pt-7 xl:px-8">
          <Outlet />
        </main>
        <CreateProjectDialog open={showCreateProject} onOpenChange={() => undefined} />
      </div>
      <Toaster />
    </div>
  );
}

function DashboardUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#040405] px-6">
      <div className="w-full max-w-md rounded-2xl border border-[#242426] bg-[#0B0B0C] p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-[#ACFC15]" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-semibold text-[#F6F6F6]">We couldn't load your workspace</h1>
        <p className="mt-2 text-sm leading-6 text-[#989898]">The API did not respond. Make sure the backend is running and your session is valid, then try again.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={onRetry}>Try again</Button>
          <Button variant="ghost" asChild className="text-[#989898] hover:text-[#F6F6F6]">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function DashboardLoading() {
  return <div className="min-h-screen bg-[#040405]"><div className="flex min-h-screen"><aside className="hidden w-60 border-r border-[#242426] bg-[#0B0B0C] lg:block" /><main className="flex-1 p-6 sm:p-8"><div className="mx-auto max-w-[1440px] space-y-6"><Skeleton className="h-9 w-48" /><Skeleton className="h-4 w-80" /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((item) => <Skeleton key={item} className="h-32 rounded-2xl" />)}</div><Skeleton className="h-[420px] rounded-2xl" /></div></main></div></div>;
}
