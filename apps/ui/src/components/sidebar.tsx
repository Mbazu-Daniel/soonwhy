import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '~/lib/utils';
import { useSidebar } from '~/lib/sidebar-context';
import { useProject } from '~/lib/project-context';
import { AlertTriangle, ArrowLeft, BrainCircuit, ChevronRight, GitBranch, LayoutDashboard, ScrollText, Server, Settings, ShieldCheck } from 'lucide-react';

const navItems = [
  { to: '/$organizationSlug/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/$organizationSlug/services', label: 'Services', icon: Server },
  { to: '/$organizationSlug/detections', label: 'Detections', icon: BrainCircuit },
  { to: '/$organizationSlug/investigations', label: 'Investigations', icon: ShieldCheck },
  { to: '/$organizationSlug/ai', label: 'AI Agent', icon: BrainCircuit },
  { to: '/$organizationSlug/errors', label: 'Errors', icon: AlertTriangle },
  { to: '/$organizationSlug/logs', label: 'Logs', icon: ScrollText },
  { to: '/$organizationSlug/traces', label: 'Traces', icon: GitBranch },
] as const;

export function Sidebar() {
  const location = useLocation();
  const { open, close } = useSidebar();
  const { orgSlug } = useProject();

  if (!orgSlug) return null;

  return (
    <>
      <div className={open ? 'fixed inset-0 z-40 bg-[#0B0B0C]/30 lg:hidden' : 'hidden'} onClick={close} aria-hidden="true" />
      <aside className={cn('w-64 shrink-0 border-r border-[#242426] bg-[#040405] flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')} aria-label="Primary navigation">
        <div className="h-16 border-b border-[#1B1B1D] px-4 flex items-center">
          <Link to="/$organizationSlug/dashboard" params={{ organizationSlug: orgSlug }} onClick={close} className="flex w-full items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0B0B0C] text-sm font-bold text-[#ACFC15]">S</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight text-[#F6F6F6]">SoonWhy</span>
              <span className="block truncate text-[10px] uppercase tracking-[.12em] text-[#98A292]">Observability</span>
            </span>
          </Link>
        </div>

        <div className="px-3 pt-6">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.15em] text-[#98A292]">Monitor</p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const href = item.to.replace('/$organizationSlug', `/${orgSlug}`);
              const active = item.exact ? location.pathname === href : location.pathname.startsWith(href);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  params={{ organizationSlug: orgSlug }}
                  onClick={close}
                  className={cn('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', active ? 'bg-[#0B0B0C] text-white' : 'text-[#989898] hover:bg-[#151517] hover:text-[#F6F6F6]')}
                  aria-current={active ? 'page' : undefined}
                >
                  <item.icon className={cn('h-[17px] w-[17px] shrink-0', active ? 'text-[#ACFC15]' : 'text-[#6E6E70]')} />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight className="h-3.5 w-3.5 text-[#ACFC15]" />}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-[#1B1B1D] p-3"><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.15em] text-[#6E6E70]">Project</p><div className="mb-2 rounded-xl border border-[#242426] bg-[#0B0B0C] px-3 py-2"><p className="truncate text-xs font-medium text-[#F6F6F6]">Project context</p><p className="mt-0.5 truncate text-[10px] text-[#6E6E70]">Choose the active project from the top bar</p></div><div className="space-y-1">
          <Link to="/$organizationSlug/settings" params={{ organizationSlug: orgSlug }} onClick={close} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium', location.pathname.startsWith(`/${orgSlug}/settings`) ? 'bg-[#151517] text-[#F6F6F6]' : 'text-[#989898] hover:bg-[#151517] hover:text-[#F6F6F6]')}>
            <Settings className="h-[17px] w-[17px]" />
            Setup
          </Link>
          <Link to="/$organizationSlug" params={{ organizationSlug: orgSlug }} onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#989898] hover:bg-[#151517] hover:text-[#F6F6F6]">
            <ArrowLeft className="h-[17px] w-[17px]" />
            Workspace
          </Link>
        </div>
        </div>
      </aside>
    </>
  );
}
