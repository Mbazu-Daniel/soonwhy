import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { CommandPalette } from '~/components/command-palette';
import { WorkspaceMenu } from '~/components/workspace-switcher';
import { api } from '~/lib/api';
import { signOut, clearSession, getSessionToken } from '~/lib/auth-client';
import { LogOut, Menu } from 'lucide-react';
import { useSidebar } from '~/lib/sidebar-context';

interface SessionUser { user: { id: string; email: string; name: string | null }; }

export function TopBar() {
  const navigate = useNavigate();
  const token = getSessionToken();
  const { toggle } = useSidebar();
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: () => api.get<SessionUser>('/auth/session'), enabled: !!token, retry: false });

  async function handleSignOut() {
    if (token) await signOut(token);
    clearSession();
    navigate({ to: '/login' });
  }

  const userName = session?.user?.name || session?.user?.email || 'U';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-[#242426] bg-[#0B0B0C] px-3 py-2 sm:px-4 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 text-[#989898] hover:bg-[#151517] hover:text-[#F6F6F6] lg:hidden" onClick={toggle} aria-label="Toggle sidebar"><Menu className="h-5 w-5" /></Button>
        <WorkspaceMenu />
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <CommandPalette />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 pl-2 text-[#F6F6F6]" aria-label="User menu">
              <Avatar className="h-8 w-8"><AvatarFallback className="bg-[#C9E7EB] text-[#182012] font-semibold">{userInitial}</AvatarFallback></Avatar>
              <span className="hidden max-w-28 truncate text-sm font-medium lg:block">{userName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {session?.user && <><div className="px-2 py-2"><p className="truncate text-sm font-medium">{session.user.name || session.user.email}</p>{session.user.name && <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>}</div><DropdownMenuSeparator /></>}
            <DropdownMenuItem onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
