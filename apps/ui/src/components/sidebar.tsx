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
      <div className={open ? 'fixed inset-0 z-40 bg-[#182012]/30 lg:hidden' : 'hidden'} onClick={close} aria-hidden="true" />
      <aside className={cn('w-64 shrink-0 border-r border-[#DBE5D7] bg-white flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')} aria-label="Primary navigation">
        <div className="h-16 border-b border-[#EEF2EA] px-4 flex items-center">
          <Link to="/$organizationSlug/dashboard" params={{ organizationSlug: orgSlug }} onClick={close} className="flex w-full items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#182012] text-sm font-bold text-[#8BD125]">S</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight text-[#182012]">SoonWhy</span>
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
                  className={cn('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', active ? 'bg-[#182012] text-white' : 'text-[#687462] hover:bg-[#F1F5EE] hover:text-[#182012]')}
                  aria-current={active ? 'page' : undefined}
                >
                  <item.icon className={cn('h-[17px] w-[17px] shrink-0', active ? 'text-[#8BD125]' : 'text-[#7A8574]')} />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight className="h-3.5 w-3.5 text-[#8BD125]" />}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto space-y-1 border-t border-[#EEF2EA] p-3">
          <Link to="/$organizationSlug/dashboard/settings" params={{ organizationSlug: orgSlug }} onClick={close} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium', location.pathname.startsWith(`/${orgSlug}/dashboard/settings`) ? 'bg-[#F1F5EE] text-[#182012]' : 'text-[#687462] hover:bg-[#F1F5EE] hover:text-[#182012]')}>
            <Settings className="h-[17px] w-[17px]" />
            Setup
          </Link>
          <Link to="/$organizationSlug" params={{ organizationSlug: orgSlug }} onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#687462] hover:bg-[#F1F5EE] hover:text-[#182012]">
            <ArrowLeft className="h-[17px] w-[17px]" />
            Workspace
          </Link>
        </div>
      </aside>
    </>
  );
}
