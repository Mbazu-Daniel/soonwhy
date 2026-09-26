import { Link, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { cn } from '~/lib/utils';
import { useSidebar } from '~/lib/sidebar-context';
import { useProject } from '~/lib/project-context';
import { api } from '~/lib/api';
import { AlertTriangle, ArrowLeft, BrainCircuit, ChevronRight, GitBranch, LayoutDashboard, PanelLeft, ScrollText, Server, Settings, FolderKanban, Plus, Network, Rocket, Target, KeyRound } from 'lucide-react';

interface Project { id: string; name: string; slug: string; }

const navItems = [
  { to: '/$organizationSlug/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/$organizationSlug/services', label: 'Services', icon: Server },
  { to: '/$organizationSlug/service-map', label: 'Service map', icon: Network },
  { to: '/$organizationSlug/deployments', label: 'Deployments', icon: Rocket },
  { to: '/$organizationSlug/operations', label: 'Operations', icon: Target },
  { to: '/$organizationSlug/api-keys', label: 'API keys', icon: KeyRound },
  { to: '/$organizationSlug/detections', label: 'Detections', icon: BrainCircuit },
  { to: '/$organizationSlug/investigations', label: 'Investigations', icon: FolderKanban },
  { to: '/$organizationSlug/ai', label: 'AI Agent', icon: BrainCircuit },
  { to: '/$organizationSlug/errors', label: 'Errors', icon: AlertTriangle },
  { to: '/$organizationSlug/logs', label: 'Logs', icon: ScrollText },
  { to: '/$organizationSlug/traces', label: 'Traces', icon: GitBranch },
] as const;

export function Sidebar() {
  const location = useLocation();
  const { open, close, collapsed, toggleCollapsed } = useSidebar();
  const { orgSlug, projectId, setProjectId } = useProject();
  const projects = useQuery({ queryKey: ['projects', orgSlug], queryFn: () => api.get<Project[]>('/projects'), enabled: !!orgSlug });
  if (!orgSlug) return null;

  return (
    <>
      <div className={open ? 'fixed inset-0 z-40 bg-[#0B0B0C]/30 lg:hidden' : 'hidden'} onClick={close} aria-hidden="true" />
      <aside className={cn('w-64 shrink-0 border-r border-[#242426] bg-[#040405] flex flex-col fixed inset-y-0 left-0 z-50 transition-[width,transform] duration-200 lg:static lg:translate-x-0', collapsed ? 'lg:w-16' : 'lg:w-64', open ? 'translate-x-0' : '-translate-x-full')} aria-label="Primary navigation">
        <div className="px-3 pt-2.5 sm:pt-[18px]">
          {collapsed && <button type="button" onClick={toggleCollapsed} aria-label="Expand sidebar" className="mb-2 hidden h-9 w-full items-center justify-center rounded-xl text-[#989898] hover:bg-[#151517] lg:flex"><PanelLeft className="h-4 w-4" /></button>}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const href = item.to.replace('/$organizationSlug', `/${orgSlug}`);
              const active = item.exact ? location.pathname === href : location.pathname.startsWith(href);
              return <Link key={item.to} to={item.to} params={{ organizationSlug: orgSlug }} onClick={close} title={item.label} className={cn('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', collapsed && 'lg:justify-center lg:px-2', active ? 'bg-[#0B0B0C] text-white' : 'text-[#989898] hover:bg-[#151517] hover:text-[#F6F6F6]')} aria-current={active ? 'page' : undefined}>
                <item.icon className={cn('h-[17px] w-[17px] shrink-0', active ? 'text-[#ACFC15]' : 'text-[#6E6E70')} /><span className={cn('flex-1', collapsed && 'lg:hidden')}>{item.label}</span>{active && <ChevronRight className={cn('h-3.5 w-3.5 text-[#ACFC15]', collapsed && 'lg:hidden')} />}
              </Link>;
            })}
          </nav>
        </div>
        <div className="mt-auto border-t border-[#1B1B1D] p-3">
          <p className={cn('mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.15em] text-[#6E6E70]', collapsed && 'lg:hidden')}>Project</p>
          <div className={cn('rounded-xl border border-[#242426] bg-[#0B0B0C] p-2', collapsed && 'lg:hidden')}>
            <label htmlFor="sidebar-project" className="mb-1 block px-1 text-[10px] uppercase tracking-[.12em] text-[#6E6E70]">Active project</label>
            <select id="sidebar-project" value={projectId ?? ''} onChange={(event) => setProjectId(event.target.value)} className="h-9 w-full rounded-lg border border-[#242426] bg-[#151517] px-2 text-xs text-[#F6F6F6] outline-none focus:border-[#ACFC15]">
              <option value="" disabled>Select project</option>{projects.data?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <div className="mt-2 flex items-center gap-2 px-1 text-[10px] text-[#6E6E70]"><span className="h-1.5 w-1.5 rounded-full bg-[#ACFC15]" />{projects.isLoading ? 'Loading projects…' : projects.data?.length ? `${projects.data.length} project${projects.data.length === 1 ? '' : 's'}` : 'No projects yet'}</div>
          </div>
          <div className="mt-2 space-y-1">
            <Link to="/$organizationSlug/settings" params={{ organizationSlug: orgSlug }} onClick={close} title="Setup" className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium', collapsed && 'lg:justify-center lg:px-2', location.pathname.startsWith(`/${orgSlug}/settings`) ? 'bg-[#151517] text-[#F6F6F6]' : 'text-[#989898] hover:bg-[#151517] hover:text-[#F6F6F6]')}><Settings className="h-[17px] w-[17px]" /><span className={cn(collapsed && 'lg:hidden')}>Setup</span></Link>
            <Link to="/onboarding" onClick={close} title="Add project" className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#989898] hover:bg-[#151517] hover:text-[#F6F6F6]', collapsed && 'lg:justify-center lg:px-2')}><Plus className="h-[17px] w-[17px]" /><span className={cn(collapsed && 'lg:hidden')}>Add project</span></Link>
            <Link to="/$organizationSlug" params={{ organizationSlug: orgSlug }} onClick={close} title="Workspace" className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#989898] hover:bg-[#151517] hover:text-[#F6F6F6]', collapsed && 'lg:justify-center lg:px-2')}><ArrowLeft className="h-[17px] w-[17px]" /><span className={cn(collapsed && 'lg:hidden')}>Workspace</span></Link>
          </div>
        </div>
      </aside>
    </>
  );
}
