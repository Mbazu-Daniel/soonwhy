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
import { ChevronDown, LogOut, Menu, Sun, Moon, Monitor, Bot, Search, Bell } from 'lucide-react';
import { useSidebar } from '~/lib/sidebar-context';
import { useEffect, useState } from 'react';

interface Project { id: string; name: string; slug: string; }
interface SessionUser { user: { id: string; email: string; name: string | null; }; }

export function TopBar() {
  const navigate = useNavigate();
  const { projectId, orgId, setProjectId } = useProject();
  const token = getSessionToken();
  const { toggle } = useSidebar();
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  useEffect(() => {
    const saved = localStorage.getItem('soonwhy-theme') as 'light' | 'dark' | 'system' | null;
    if (saved) setTheme(saved);
  }, []);
  function changeTheme(value: 'light' | 'dark' | 'system') {
    setTheme(value);
    localStorage.setItem('soonwhy-theme', value);
    document.documentElement.classList.toggle('dark', value === 'dark' || (value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
  }

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: () => api.get<SessionUser>('/auth/session'), enabled: !!token, retry: false });
  const { data: projects } = useQuery({ queryKey: ['projects', orgId], queryFn: () => api.get<Project[]>('/projects'), enabled: !!orgId });

  async function handleSignOut() {
    if (token) await signOut(token);
    clearSession();
    navigate({ to: '/login' });
  }

  const userName = session?.user?.name || session?.user?.email || 'U';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-[#242426] bg-[#040405] px-3 py-2 sm:px-4 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={toggle} aria-label="Toggle sidebar"><Menu className="h-5 w-5" /></Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="hidden text-xs font-medium text-[#989898] md:block">Project</span>
          {projects && projects.length > 0 ? (
            <Select value={projectId || ''} onValueChange={setProjectId}>
              <SelectTrigger data-tour="project-selector" className="h-9 w-full max-w-72 border-[#242426] bg-[#151517] sm:w-64"><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : <span className="truncate text-sm font-semibold">No project selected</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button type="button" className="hidden h-9 items-center gap-2 rounded-lg border border-[#242426] px-3 text-xs text-[#989898] hover:bg-[#151517] lg:flex"><Search className="h-3.5 w-3.5"/> Search</button><button type="button" className="grid h-9 w-9 place-items-center rounded-lg border border-[#242426] text-[#989898] hover:bg-[#151517]" aria-label="AI assistant"><Bot className="h-4 w-4"/></button><button type="button" className="grid h-9 w-9 place-items-center rounded-lg border border-[#242426] text-[#989898] hover:bg-[#151517]" aria-label="Notifications"><Bell className="h-4 w-4"/></button><CommandPalette />
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" className="flex items-center gap-2 pl-2" aria-label="User menu"><Avatar className="h-8 w-8"><AvatarFallback className="bg-[#415312] text-[#F6F6F6] font-semibold">{userInitial}</AvatarFallback></Avatar><span className="hidden lg:block max-w-28 truncate text-sm font-medium">{userName}</span><ChevronDown className="h-3.5 w-3.5 text-[#989898]" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {session?.user && <><div className="px-2 py-2"><p className="font-medium text-sm truncate">{session.user.name || session.user.email}</p>{session.user.name && <p className="text-xs text-[#989898] truncate">{session.user.email}</p>}</div><DropdownMenuSeparator /></>}
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-[#989898]">Appearance</div>
            <DropdownMenuItem onClick={() => changeTheme('light')}><Sun className="h-4 w-4 mr-2" />Light {theme === 'light' && <span className="ml-auto">✓</span>}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeTheme('dark')}><Moon className="h-4 w-4 mr-2" />Dark {theme === 'dark' && <span className="ml-auto">✓</span>}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeTheme('system')}><Monitor className="h-4 w-4 mr-2" />System {theme === 'system' && <span className="ml-auto">✓</span>}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}><LogOut className="h-4 w-4 mr-2" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
