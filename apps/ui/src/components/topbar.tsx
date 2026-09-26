import { Button } from '~/components/ui/button';
import { useNavigate } from '@tanstack/react-router';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Menu } from 'lucide-react';
import { api } from '~/lib/api';
import { clearSession, getSessionToken, signOut } from '~/lib/auth-client';
import { CommandPalette } from '~/components/command-palette';
import { useSidebar } from '~/lib/sidebar-context';

export function TopBar() {
  const { toggle } = useSidebar();
  const navigate = useNavigate();
  const token = getSessionToken();
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<{ user: { id: string; email: string; name: string | null } }>('/auth/session'),
    enabled: !!token,
    retry: false,
  });

  const userName = session.data?.user?.name || session.data?.user?.email || 'User';
  const userInitial = userName.charAt(0).toUpperCase();

  async function handleSignOut() {
    if (token) await signOut(token);
    clearSession();
    void navigate({ to: '/login' });
  }

  return (
    <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-2 sm:px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={toggle} aria-label="Toggle sidebar">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <CommandPalette />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[#C9E7EB] text-[#182012] text-xs font-semibold">{userInitial}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-36 truncate text-sm font-medium sm:inline">{userName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {session.data?.user && (
              <>
                <div className="px-2 py-2">
                  <p className="truncate text-sm font-medium">{session.data.user.name || session.data.user.email}</p>
                  {session.data.user.name && <p className="truncate text-xs text-muted-foreground">{session.data.user.email}</p>}
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
