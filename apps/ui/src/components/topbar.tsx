import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { CommandPalette } from '~/components/command-palette';
import { api } from '~/lib/api';
import { signOut, clearSession, getSessionToken } from '~/lib/auth-client';
import { useProject } from '~/lib/project-context';
import { WorkspaceMenu } from '~/components/workspace-switcher';
import { ChevronDown, LogOut, Menu, PanelLeft, Sun, Moon, Monitor, Bot, Search } from 'lucide-react';
import { cn } from '~/lib/utils';
import { useSidebar } from '~/lib/sidebar-context';
import { useEffect, useState } from 'react';

interface SessionUser { user: { id: string; email: string; name: string | null; }; }

export function TopBar() {
  const navigate = useNavigate();
  const { orgSlug } = useProject();
  const token = getSessionToken();
  const { toggle, collapsed, toggleCollapsed } = useSidebar();
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  useEffect(() => {
    const saved = localStorage.getItem('soonwhy-theme') as 'light' | 'dark' | 'system' | null;
    const next = saved ?? 'system'; setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark' || (next === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
  }, []);
  function changeTheme(value: 'light' | 'dark' | 'system') {
    setTheme(value); localStorage.setItem('soonwhy-theme', value);
    document.documentElement.classList.toggle('dark', value === 'dark' || (value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
  }
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: () => api.get<SessionUser>('/auth/session'), enabled: !!token, retry: false });
  async function handleSignOut() { if (token) await signOut(token); clearSession(); navigate({ to: '/login' }); }
  const userName = session?.user?.name || session?.user?.email || 'U'; const userInitial = userName.charAt(0).toUpperCase();

  return <header className="flex h-16 shrink-0 border-b border-[#242426] bg-[#040405]">
    <div className={cn('hidden items-center gap-2 border-r border-[#242426] px-3 lg:flex', collapsed ? 'w-16 justify-center px-2' : 'w-64')}>
      <WorkspaceMenu compact={collapsed} />
      {!collapsed && <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-[#989898] hover:bg-[#151517]" onClick={toggleCollapsed} aria-label="Collapse sidebar"><PanelLeft className="h-4 w-4" /></Button>}
    </div>
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
    <div className="flex min-w-0 items-center gap-2 lg:hidden">
      <Button variant="ghost" size="icon" className="shrink-0" onClick={toggle} aria-label="Toggle sidebar"><Menu className="h-5 w-5" /></Button>
      <WorkspaceMenu />
    </div>
    <div className="flex items-center gap-1.5 sm:gap-2">
      <CommandPalette />
      <Button variant="ghost" className="hidden h-9 items-center gap-2 border border-[#242426] px-3 text-xs text-[#989898] hover:bg-[#151517] lg:flex" aria-label="Open search" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}><Search className="h-3.5 w-3.5" /> Search</Button>
      <Button variant="ghost" size="icon" className="h-9 w-9 border border-[#242426] text-[#989898] hover:bg-[#151517]" aria-label="Open AI agent" onClick={() => orgSlug && navigate({ to: '/$organizationSlug/ai', params: { organizationSlug: orgSlug } })}><Bot className="h-4 w-4" /></Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" className="flex items-center gap-2 pl-2" aria-label="User menu"><Avatar className="h-8 w-8"><AvatarFallback className="bg-[#415312] text-[#F6F6F6] font-semibold">{userInitial}</AvatarFallback></Avatar><span className="hidden max-w-28 truncate text-sm font-medium lg:block">{userName}</span><ChevronDown className="h-3.5 w-3.5 text-[#989898]" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {session?.user && <><div className="px-2 py-2"><p className="truncate text-sm font-medium">{session.user.name || session.user.email}</p>{session.user.name && <p className="truncate text-xs text-[#989898]">{session.user.email}</p>}</div><DropdownMenuSeparator /></>}
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-[#989898]">Appearance</div>
          <DropdownMenuItem onClick={() => changeTheme('light')}><Sun className="mr-2 h-4 w-4" />Light {theme === 'light' && <span className="ml-auto">✓</span>}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => changeTheme('dark')}><Moon className="mr-2 h-4 w-4" />Dark {theme === 'dark' && <span className="ml-auto">✓</span>}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => changeTheme('system')}><Monitor className="mr-2 h-4 w-4" />System {theme === 'system' && <span className="ml-auto">✓</span>}</DropdownMenuItem>
          <DropdownMenuSeparator /><DropdownMenuItem onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    </div>
  </header>;
}
