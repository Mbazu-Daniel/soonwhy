import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { cn } from '~/lib/utils';
import { useSidebar } from '~/lib/sidebar-context';
import { useProject } from '~/lib/project-context';
import { Button } from '~/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { signOut, clearSession, getSessionToken } from '~/lib/auth-client';
import { AlertTriangle, BarChart3, Bell, BrainCircuit, Activity, Check, ChevronDown, ChevronRight, Database, GitBranch, KeyRound, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Plus, ScrollText, Send, Server, Settings, Sparkles } from 'lucide-react';
import { api } from '~/lib/api';
import { WorkspaceMenu } from '~/components/workspace-switcher';
import { CreateProjectDialog } from '~/components/create-project-dialog';

interface Project { id: string; name: string; slug: string; }

const navGroups = [
  { label: 'Monitor', items: [
    { to: 'overview', label: 'Overview', icon: LayoutDashboard, exact: true },
    { to: 'services', label: 'Services', icon: Server },
    { to: 'errors', label: 'Errors', icon: AlertTriangle },
    { to: 'logs', label: 'Logs', icon: ScrollText },
    { to: 'traces', label: 'Traces', icon: GitBranch },
    { to: 'metrics', label: 'Metrics', icon: BarChart3 },
  ] },
  { label: 'Intelligence', items: [
    { to: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
  ] },
  { label: 'Configuration', items: [
    { to: 'alerts', label: 'Alerts', icon: Bell },
    { to: 'notifications', label: 'Notifications', icon: Send },
    { to: 'api-keys', label: 'API Keys', icon: KeyRound },
    { to: 'ai', label: 'AI Providers', icon: Sparkles, orgLevel: true },
    { to: 'settings', label: 'Settings', icon: Settings, orgLevel: true },
    // { to: 'self-observability', label: 'AI & Ops', icon: Activity, orgLevel: true, adminOnly: true },
  ] },
] as const;

const adminItems = [
  { to: '/admin/dlq', label: 'DLQ', icon: Database },
  { to: '/admin/ingest-health', label: 'Ingest Health', icon: Activity },
  { to: '/admin/system-health', label: 'System Health', icon: Server },
] as const;

interface SessionUser { user: { id: string; email: string; name: string | null; image?: string | null }; }

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const token = getSessionToken();
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: () => api.get<SessionUser>('/auth/session'), enabled: !!token, retry: false });
  const userName = session?.user?.name || session?.user?.email || 'U';
  const userInitial = userName.charAt(0).toUpperCase();

  async function handleSignOut() {
    if (token) await signOut(token);
    clearSession();
    navigate({ to: '/login' });
  }

  return (
    <div className={cn('shrink-0 border-t border-[#242426] p-2', collapsed && 'flex justify-center')}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className={cn('h-11 text-[#F6F6F6] hover:bg-[#151517]', collapsed ? 'w-11 px-0' : 'w-full justify-start gap-3 px-2')} aria-label="User menu">
            {session?.user?.image ? (
              <img src={session.user.image} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-[#C9E7EB] font-semibold text-[#182012]">{userInitial}</AvatarFallback></Avatar>
            )}
            {!collapsed && <span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{userName}</span>{session?.user?.name && <span className="block truncate text-xs text-[#989898]">{session.user.email}</span>}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56 border-[#242426] bg-[#0B0B0C] text-[#F6F6F6]">
          {session?.user && <><div className="px-2 py-2"><p className="truncate text-sm font-medium">{session.user.name || session.user.email}</p>{session.user.name && <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>}</div><DropdownMenuSeparator className="bg-[#242426]" /></>}
          <DropdownMenuItem onClick={handleSignOut} className="focus:bg-[#151517] focus:text-[#F6F6F6]"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { open, close, collapsed, toggleCollapsed } = useSidebar();
  const { orgId, orgSlug, projectSlug: contextProjectSlug, setProject } = useProject();

  const projects = useQuery({ queryKey: ['projects', orgId], queryFn: () => api.get<Project[]>('/projects'), enabled: !!orgId });
  const member = useQuery({ queryKey: ['member-context', orgId], queryFn: () => api.get<{ role: string }>('/member-context'), enabled: !!orgId, retry: false, staleTime: 300_000 });
  const canViewOps = member.data?.role === 'owner' || member.data?.role === 'admin';
  const staff = useQuery({ queryKey: ['platform-admin-me'], queryFn: () => api.get<{ platformRole: 'none' | 'admin' | 'super_admin' }>('/admin/me'), retry: false, staleTime: 300_000 });
  const platformRole = staff.data?.platformRole ?? 'none';
  const isStaff = platformRole !== 'none';
  const urlProjectSlug = location.pathname.match(/^\/[^/]+\/p\/([^/]+)/)?.[1] ?? null;
  const selectedProjectSlug = urlProjectSlug ?? contextProjectSlug ?? projects.data?.[0]?.slug ?? null;
  const currentProject = projects.data?.find((project) => project.slug === selectedProjectSlug) ?? projects.data?.[0];
  const [createOpen, setCreateOpen] = useState(false);

  function selectProject(project: Project) {
    setProject(project);
    if (orgSlug) void navigate({ to: '/$organizationSlug/p/$projectSlug', params: { organizationSlug: orgSlug, projectSlug: project.slug } });
    close();
  }

  useEffect(() => {
    if (!projects.data?.length || urlProjectSlug) return;
    const project = projects.data.find((item) => item.slug === contextProjectSlug) ?? projects.data[0];
    if (project && project.id !== contextProjectSlug) setProject(project);
  }, [projects.data, setProject, urlProjectSlug, contextProjectSlug]);

  return (
    <>
      <div className={open ? 'fixed inset-0 z-40 bg-black/30 lg:hidden' : 'hidden'} onClick={close} aria-hidden="true" />
      <aside className={cn(
        'border-r border-[#242426] bg-[#0B0B0C] flex flex-col fixed top-0 bottom-0 left-0 z-50 w-60 transition-all duration-200 lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full', collapsed ? 'lg:w-16' : 'lg:w-60',
      )} aria-label="Primary navigation">
        <div className={cn('shrink-0 border-b border-[#242426] p-3', collapsed && 'p-2')}>
          <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
            <WorkspaceMenu compact={collapsed} />
            <Button variant="ghost" size="icon" className="hidden h-9 w-9 shrink-0 text-[#989898] hover:bg-[#151517] hover:text-[#F6F6F6] lg:inline-flex" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className={cn('shrink-0 border-b border-[#242426] p-3', collapsed && 'p-2')}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={cn('h-12 w-full justify-start text-[#F6F6F6]', collapsed ? 'px-0 justify-center' : 'gap-3 px-2')}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#151517] text-sm font-semibold text-[#ACFC15]">{currentProject?.name?.charAt(0).toUpperCase() || <Plus className="h-4 w-4" />}</span>
                {!collapsed && <span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{currentProject?.name || 'Select project'}</span><span className="block truncate text-xs text-[#989898]">Project</span></span>}
                {!collapsed && <ChevronDown className="h-4 w-4 shrink-0 text-[#989898]" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="w-60 border-[#242426] bg-[#0B0B0C] text-[#F6F6F6]">
              <DropdownMenuGroup>{projects.data?.map((project) => <DropdownMenuItem key={project.id} onClick={() => selectProject(project)} className="focus:bg-[#151517] focus:text-[#F6F6F6]"><span className="flex h-6 w-6 items-center justify-center rounded bg-[#151517] text-xs font-semibold text-[#ACFC15]">{project.name.charAt(0).toUpperCase()}</span><span className="min-w-0 flex-1 truncate">{project.name}</span>{project.slug === selectedProjectSlug && <Check className="h-4 w-4 text-[#ACFC15]" />}</DropdownMenuItem>)}</DropdownMenuGroup>
              {projects.data?.length ? <DropdownMenuSeparator className="bg-[#242426]" /> : null}
              <DropdownMenuItem onClick={() => setCreateOpen(true)} className="focus:bg-[#151517] focus:text-[#F6F6F6]"><Plus className="h-4 w-4" />Create project</DropdownMenuItem>
              {orgSlug ? <DropdownMenuItem onClick={() => void navigate({ to: '/$organizationSlug/settings', params: { organizationSlug: orgSlug } })} className="focus:bg-[#151517] focus:text-[#F6F6F6]"><Settings className="h-4 w-4" />Settings</DropdownMenuItem> : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className={cn('flex-1 overflow-y-auto pt-5 pb-3', collapsed ? 'px-2' : 'px-3')}>
          <nav className="space-y-4">{navGroups.map((group) => <div key={group.label}>{!collapsed && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.14em] text-[#989898]">{group.label}</p>}<div className="space-y-1">{group.items.filter((item) => !(item as any).adminOnly || canViewOps).map((item) => { const isOrgLevel = !!(item as any).orgLevel; const to = orgSlug ? (isOrgLevel ? '/$organizationSlug/' + item.to : (selectedProjectSlug ? (item.to === 'overview' ? '/$organizationSlug/p/$projectSlug/' : `/$organizationSlug/p/$projectSlug/${item.to}`) : '/organizations')) : '/organizations'; const target = orgSlug ? (isOrgLevel ? `/${orgSlug}/${item.to}` : (selectedProjectSlug ? (item.to === 'overview' ? `/${orgSlug}/p/${selectedProjectSlug}/` : `/${orgSlug}/p/${selectedProjectSlug}/${item.to}`) : '/organizations')) : '/organizations'; const currentPath = location.pathname.replace(/\/+$/, ''); const targetPath = target.replace(/\/+$/, ''); const active = targetPath !== '/organizations' && (('exact' in item ? item.exact : false) ? currentPath === targetPath : currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)); return <Link key={item.to} to={to as never} params={(orgSlug ? { organizationSlug: orgSlug, ...(isOrgLevel ? {} : { projectSlug: selectedProjectSlug ?? '' }) } : undefined) as never} onClick={close} title={collapsed ? item.label : undefined} className={cn('group flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors', collapsed ? 'justify-center px-2' : 'gap-3 px-3', active ? 'bg-[#ACFC15] text-[#182012]' : 'text-[#989898] hover:bg-[#151517] hover:text-[#F6F6F6]')} aria-current={active ? 'page' : undefined}><item.icon className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />{!collapsed && <span className="flex-1">{item.label}</span>}{!collapsed && active && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}</Link>; })}</div></div>)}{isStaff && <div><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.14em] text-[#989898]">SoonWhy Staff<span className="ml-2 rounded bg-[#151517] px-1.5 py-0.5 normal-case tracking-normal text-[#ACFC15]">{platformRole.replace('_', ' ')}</span></p><div className="space-y-1">{adminItems.map((item) => { const currentPath = location.pathname.replace(/\/+$/, ''); const target = item.to.replace(/\/+$/, ''); const active = currentPath === target || currentPath.startsWith(target + '/'); return <Link key={item.to} to={item.to as never} title={collapsed ? item.label : undefined} className={cn('group flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors', collapsed ? 'justify-center px-2' : 'gap-3 px-3', active ? 'bg-[#ACFC15] text-[#182012]' : 'text-[#989898] hover:bg-[#151517] hover:text-[#F6F6F6]')} aria-current={active ? 'page' : undefined}><item.icon className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />{!collapsed && <span className="flex-1">{item.label}</span>}{!collapsed && active && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}</Link>; })}</div></div>}</nav>
        </div>
        <UserMenu collapsed={collapsed} />
      </aside>
      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
