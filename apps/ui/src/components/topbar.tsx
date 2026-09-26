import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { CommandPalette } from '~/components/command-palette';
import { api } from '~/lib/api';
import { signOut, clearSession, getSessionToken } from '~/lib/auth-client';
import { ChevronDown, LogOut, Menu } from 'lucide-react';
import { useSidebar } from '~/lib/sidebar-context';

interface SessionUser { user: { id: string; email: string; name: string | null; }; }

export function TopBar() {
  const navigate = useNavigate();
  const token = getSessionToken();
  const { toggle } = useSidebar();

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<SessionUser>('/auth/session'),
    enabled: !!token,
    retry: false,
  });

  async function handleSignOut() {
    if (token) await signOut(token);
    clearSession();
    navigate({ to: '/login' });
  }

  const userName = session?.user?.name || session?.user?.email || 'U';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 py-2 sm:px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={toggle} aria-label="Toggle sidebar">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <CommandPalette />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 pl-2" aria-label="User menu">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[#C9E7EB] text-[#182012] font-semibold">{userInitial}</AvatarFallback>
              </Avatar>
              <span className="hidden lg:block max-w-28 truncate text-sm font-medium">{userName}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {session?.user && (
              <>
                <div className="px-2 py-2">
                  <p className="font-medium text-sm truncate">{session.user.name || session.user.email}</p>
                  {session.user.name && <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>}
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
