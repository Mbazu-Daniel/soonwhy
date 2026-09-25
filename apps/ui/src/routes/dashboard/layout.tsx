import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '~/components/sidebar';
import { TopBar } from '~/components/topbar';
import { Toaster } from '~/components/ui/sonner';
import { Skeleton } from '~/components/ui/skeleton';
import { SidebarProvider } from '~/lib/sidebar-context';
import { getSessionToken, clearSession } from '~/lib/auth-client';
import { api } from '~/lib/api';

export const Route = createFileRoute('/dashboard/layout')({
  component: DashboardLayout,
});

function DashboardLayout() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const token = getSessionToken();

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<{ user: { id: string } }>('/auth/session'),
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (sessionLoading) return;

    if (!token || !session) {
      clearSession();
      navigate({ to: '/auth/sign-in' });
      return;
    }

    const orgId = localStorage.getItem('org_id');
    if (!orgId) {
      navigate({ to: '/organizations' });
      return;
    }

    setChecking(false);
  }, [token, session, sessionLoading, navigate]);

  if (checking) return <DashboardLoading />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto bg-background p-4 sm:p-5 lg:p-6">
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
    <div className="min-h-screen flex flex-col bg-background" aria-busy="true" aria-label="Loading dashboard">
      <header className="h-16 shrink-0 border-b bg-white flex items-center px-4 sm:px-6">
        <Skeleton className="h-8 w-28" />
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-60 border-r bg-white p-4 lg:block">
          <Skeleton className="mb-8 h-9 w-full" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-10 w-full" />)}
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-[1440px] space-y-6">
            <div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-80 max-w-full" /></div>
            <div className="grid gap-4 xl:grid-cols-[300px_1fr]"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28" />)}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
