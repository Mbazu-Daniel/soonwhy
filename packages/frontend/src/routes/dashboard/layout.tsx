import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '~/components/sidebar';
import { TopBar } from '~/components/topbar';
import { Toaster } from '~/components/ui/sonner';
import { Skeleton } from '~/components/ui/skeleton';
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

    if (!token || session?.error) {
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

  if (checking) {
    return (
      <div className="h-screen flex flex-col">
        <header className="h-14 border-b flex items-center px-4">
          <Skeleton className="h-6 w-24" />
        </header>
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-60 border-r p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </aside>
          <main className="flex-1 p-6 space-y-4">
            <Skeleton className="h-40 w-full" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
}
