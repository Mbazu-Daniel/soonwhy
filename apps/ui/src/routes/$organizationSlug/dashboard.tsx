import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '~/components/sidebar';
import { TopBar } from '~/components/topbar';
import { Toaster } from '~/components/ui/sonner';
import { Skeleton } from '~/components/ui/skeleton';
import { SidebarProvider } from '~/lib/sidebar-context';
import { getSessionToken, clearSession } from '~/lib/auth-client';
import { useProject } from '~/lib/project-context';
import { api } from '~/lib/api';

interface Organization { id: string; name: string; slug: string; }

export const Route = createFileRoute('/$organizationSlug/dashboard')({
  component: OrganizationDashboardLayout,
});

function OrganizationDashboardLayout() {
  const navigate = useNavigate();
  const { organizationSlug } = Route.useParams();
  const { setOrganization } = useProject();
  const token = getSessionToken();

  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<{ user: { id: string } }>('/auth/session'),
    enabled: !!token,
    retry: false,
  });

  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<Organization[]>('/organizations'),
    enabled: !!token && !!session.data,
    retry: false,
  });

  const organization = organizations.data?.find((item) => item.slug === organizationSlug);

  useEffect(() => {
    if (session.isLoading || organizations.isLoading) return;

    if (!token || !session.data) {
      clearSession();
      void navigate({ to: '/login', replace: true });
      return;
    }

    if (!organization) {
      if (organizations.data) void navigate({ to: '/organizations', replace: true });
      return;
    }

    setOrganization({ id: organization.id, slug: organization.slug });
  }, [token, session.isLoading, session.data, organizations.isLoading, organizations.data, organization, navigate, setOrganization]);

  if (session.isLoading || organizations.isLoading || !token || !session.data || !organization) {
    return <DashboardLoading />;
  }

  return (
    <SidebarProvider>
      <div className="dashboard-shell flex min-h-dvh flex-col bg-[#F7FAF4]">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <TopBar />
        <div className="flex min-h-0 w-full flex-1">
          <Sidebar />
          <main id="main-content" tabIndex={-1} className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto bg-[#F7FAF4]">
            <Outlet />
          </main>
        </div>
        <Toaster />
      </div>
    </SidebarProvider>
  );
}

function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#F7FAF4]">
      <header className="h-16 border-b border-[#DBE5D7] bg-white" />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside className="hidden w-64 border-r border-[#DBE5D7] bg-white lg:block" />
        <main className="flex-1 p-6 sm:p-8">
          <div className="mx-auto max-w-[1440px] space-y-6">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-80" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((item) => <Skeleton key={item} className="h-32 rounded-2xl" />)}</div>
            <Skeleton className="h-[420px] rounded-2xl" />
          </div>
        </main>
      </div>
    </div>
  );
}
