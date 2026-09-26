import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { cn } from '~/lib/utils';
import { useSidebar } from '~/lib/sidebar-context';
import { useProject } from '~/lib/project-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { AlertTriangle, BrainCircuit, ChevronRight, GitBranch, LayoutDashboard, ScrollText, Server, ShieldCheck } from 'lucide-react';
import { api } from '~/lib/api';

interface Organization { id: string; name: string; slug: string; }
interface Project { id: string; name: string; slug: string; }

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/dashboard/services', label: 'Services', icon: Server },
  { to: '/dashboard/detections', label: 'Detections', icon: BrainCircuit },
  { to: '/dashboard/investigations', label: 'Investigations', icon: ShieldCheck },
  { to: '/dashboard/errors', label: 'Errors', icon: AlertTriangle },
  { to: '/dashboard/logs', label: 'Logs', icon: ScrollText },
  { to: '/dashboard/traces', label: 'Traces', icon: GitBranch },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { open, close } = useSidebar();
  const { orgId, orgSlug, projectId, setProjectId } = useProject();

  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<Organization[]>('/organizations'),
  });

  const projects = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!orgId,
  });

  const currentOrganization = organizations.data?.find((organization) => organization.id === orgId);

  return (
    <>
      <div
        className={open ? 'fixed inset-0 z-40 bg-[#182012]/30 lg:hidden' : 'hidden'}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        className={cn(
          'w-60 border-r bg-card flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Primary navigation"
      >
        <div className="border-b p-3">
          <Select
            value={orgSlug ?? ''}
            onValueChange={(slug) => {
              const organization = organizations.data?.find((item) => item.slug === slug);
              if (organization) {
                void navigate({ to: '/$organizationSlug', params: { organizationSlug: organization.slug } });
                close();
              }
            }}
          >
            <SelectTrigger className="h-10 w-full border-border bg-secondary">
              <SelectValue placeholder="Select workspace">
                {currentOrganization?.name ?? 'Select workspace'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {organizations.data?.map((organization) => (
                <SelectItem key={organization.id} value={organization.slug}>
                  {organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pt-5 pb-3">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Monitor</p>
          <nav data-tour="evidence-navigation" className="space-y-1">
            {navItems.map((item) => {
              const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={close}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <item.icon className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t p-3">
          <p className="px-1 mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Projects</p>
          {projects.data?.length ? (
            <Select value={projectId ?? ''} onValueChange={setProjectId}>
              <SelectTrigger data-tour="project-selector" className="h-10 w-full border-border bg-secondary">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.data.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              No projects yet
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
