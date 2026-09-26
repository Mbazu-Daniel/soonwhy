import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { cn } from '~/lib/utils';
import { useSidebar } from '~/lib/sidebar-context';
import { useProject } from '~/lib/project-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { AlertTriangle, BrainCircuit, Check, ChevronDown, ChevronRight, GitBranch, KeyRound, LayoutDashboard, Plus, ScrollText, Server, Settings, ShieldCheck } from 'lucide-react';
import { api } from '~/lib/api';

interface Project { id: string; name: string; slug: string; }

const navGroups = [
  { label: 'Monitor', items: [
    { to: 'overview', label: 'Overview', icon: LayoutDashboard, exact: true },
    { to: 'services', label: 'Services', icon: Server },
    { to: 'errors', label: 'Errors', icon: AlertTriangle },
    { to: 'logs', label: 'Logs', icon: ScrollText },
    { to: 'traces', label: 'Traces', icon: GitBranch },
  ] },
  { label: 'Intelligence', items: [
    { to: 'detections', label: 'Findings', icon: BrainCircuit },
    { to: 'investigations', label: 'Investigations', icon: ShieldCheck },
  ] },
  { label: 'Configuration', items: [{ to: 'api-keys', label: 'API Keys', icon: KeyRound }] },
] as const;

function projectSlug(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { open, close, collapsed } = useSidebar();
  const { orgId, orgSlug, projectSlug: contextProjectSlug, setProject } = useProject();
  const [createOpen, setCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState('');

  const projects = useQuery({ queryKey: ['projects', orgId], queryFn: () => api.get<Project[]>('/projects'), enabled: !!orgId });
  const urlProjectSlug = location.pathname.match(/^\/[^/]+\/p\/([^/]+)/)?.[1] ?? null;
  const selectedProjectSlug = urlProjectSlug ?? contextProjectSlug ?? projects.data?.[0]?.slug ?? null;
  const currentProject = projects.data?.find((project) => project.slug === selectedProjectSlug) ?? projects.data?.[0];

  const createProject = useMutation({
    mutationFn: (input: { name: string; slug: string }) => api.post<Project>('/projects', input),
    onSuccess: (project) => {
      setProject(project); setProjectName(''); setError(''); setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['projects', orgId] });
      if (orgSlug) void navigate({ to: '/$organizationSlug/p/$projectSlug/', params: { organizationSlug: orgSlug, projectSlug: project.slug } });
      close();
    },
    onError: (err: Error) => setError(err.message),
  });

  useEffect(() => {
    if (!projects.data?.length || urlProjectSlug) return;
    const project = projects.data.find((item) => item.slug === contextProjectSlug) ?? projects.data[0];
    if (project && project.id !== contextProjectSlug) setProject(project);
  }, [projects.data, setProject, urlProjectSlug, contextProjectSlug]);

  function submitProject(event: React.FormEvent) {
    event.preventDefault(); setError('');
    const name = projectName.trim(); const slug = projectSlug(name);
    if (!name || !slug) { setError('Enter a project name.'); return; }
    createProject.mutate({ name, slug });
  }

  function selectProject(project: Project) {
    setProject(project);
    if (orgSlug) void navigate({ to: '/$organizationSlug/p/$projectSlug/', params: { organizationSlug: orgSlug, projectSlug: project.slug } });
    close();
  }

  return (
    <>
      <div className={open ? 'fixed inset-0 z-40 bg-black/30 lg:hidden' : 'hidden'} onClick={close} aria-hidden="true" />
      <aside className={cn(
        'border-r border-[#242426] bg-[#0B0B0C] flex flex-col fixed top-16 bottom-0 left-0 z-50 w-60 transition-all duration-200 lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full', collapsed ? 'lg:w-16' : 'lg:w-60',
      )} aria-label="Primary navigation">
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
              {currentProject && orgSlug ? <DropdownMenuItem onClick={() => void navigate({ to: '/$organizationSlug/p/$projectSlug/settings', params: { organizationSlug: orgSlug, projectSlug: currentProject.slug } })} className="focus:bg-[#151517] focus:text-[#F6F6F6]"><Settings className="h-4 w-4" />Project settings</DropdownMenuItem> : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className={cn('flex-1 overflow-y-auto pt-5 pb-3', collapsed ? 'px-2' : 'px-3')}>
          <nav className="space-y-4">{navGroups.map((group) => <div key={group.label}>{!collapsed && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.14em] text-[#989898]">{group.label}</p>}<div className="space-y-1">{group.items.map((item) => { const to = orgSlug && selectedProjectSlug ? (item.to === 'overview' ? '/$organizationSlug/p/$projectSlug/' : `/$organizationSlug/p/$projectSlug/${item.to}`) : '/organizations'; const target = orgSlug && selectedProjectSlug ? (item.to === 'overview' ? `/${orgSlug}/p/${selectedProjectSlug}/` : `/${orgSlug}/p/${selectedProjectSlug}/${item.to}`) : '/organizations'; const currentPath = location.pathname.replace(/\/+$/, ''); const targetPath = target.replace(/\/+$/, ''); const active = targetPath !== '/organizations' && (item.exact ? currentPath === targetPath : currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)); return <Link key={item.to} to={to as never} params={orgSlug && selectedProjectSlug ? { organizationSlug: orgSlug, projectSlug: selectedProjectSlug } : undefined} onClick={close} title={collapsed ? item.label : undefined} className={cn('group flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors', collapsed ? 'justify-center px-2' : 'gap-3 px-3', active ? 'bg-[#ACFC15] text-[#182012]' : 'text-[#989898] hover:bg-[#151517] hover:text-[#F6F6F6]')} aria-current={active ? 'page' : undefined}><item.icon className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />{!collapsed && <span className="flex-1">{item.label}</span>}{!collapsed && active && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}</Link>; })}</div></div>)}</nav>
        </div>
      </aside>
      <Dialog open={createOpen} onOpenChange={(next) => { setCreateOpen(next); if (!next) setError(''); }}><DialogContent><DialogHeader><DialogTitle>Create project</DialogTitle></DialogHeader><form onSubmit={submitProject} className="space-y-4"><div className="space-y-2"><Label htmlFor="sidebar-project-name">Project name</Label><Input id="sidebar-project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Payments API" required maxLength={100} autoFocus /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={createProject.isPending}>{createProject.isPending ? 'Creating...' : 'Create project'}</Button></div></form></DialogContent></Dialog>
    </>
  );
}
