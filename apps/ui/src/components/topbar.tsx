import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { CommandPalette } from '~/components/command-palette';
import { api } from '~/lib/api';
import { signOut, clearSession, getSessionToken } from '~/lib/auth-client';
import { useProject } from '~/lib/project-context';
import { Bell, ChevronDown, Clock3, LogOut, Menu } from 'lucide-react';
import { useSidebar } from '~/lib/sidebar-context';

interface Project { id: string; name: string; slug: string; }
interface SessionUser { user: { id: string; email: string; name: string | null; }; }

export function TopBar() {
  const navigate = useNavigate();
  const { projectId, orgId, setProjectId } = useProject();
  const token = getSessionToken();
  const { toggle } = useSidebar();

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: () => api.get<SessionUser>('/auth/session'), enabled: !!token, retry: false });
  const { data: projects } = useQuery({ queryKey: ['projects', orgId], queryFn: () => api.get<Project[]>('/projects'), enabled: !!orgId });

  async function handleSignOut() {
    if (token) await signOut(token);
    clearSession();
    navigate({ to: '/auth/sign-in' });
  }

  const userName = session?.user?.name || session?.user?.email || 'U';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="h-16 shrink-0 border-b bg-white flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggle} aria-label="Toggle sidebar"><Menu className="h-5 w-5" /></Button>
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Project</span>
          {projects && projects.length > 0 ? (
            <Select value={projectId || ''} onValueChange={setProjectId}>
              <SelectTrigger className="h-9 w-52 bg-[#F7FAF4] border-[#DBE5D7]"><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : <span className="text-sm font-semibold">No project selected</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <CommandPalette />
        <Button variant="ghost" size="icon" aria-label="Time range" title="Time range"><Clock3 className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" aria-label="Notifications" title="Notifications"><Bell className="h-4 w-4" /></Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" className="flex items-center gap-2 pl-2" aria-label="User menu"><Avatar className="h-8 w-8"><AvatarFallback className="bg-[#C9E7EB] text-[#182012] font-semibold">{userInitial}</AvatarFallback></Avatar><span className="hidden lg:block max-w-28 truncate text-sm font-medium">{userName}</span><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {session?.user && <><div className="px-2 py-2"><p className="font-medium text-sm truncate">{session.user.name || session.user.email}</p>{session.user.name && <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>}</div><DropdownMenuSeparator /></>}
            <DropdownMenuItem onClick={handleSignOut}><LogOut className="h-4 w-4 mr-2" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
