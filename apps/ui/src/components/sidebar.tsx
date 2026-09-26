import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { cn } from '~/lib/utils';
import { useSidebar } from '~/lib/sidebar-context';
import { useProject } from '~/lib/project-context';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { AlertTriangle, BrainCircuit, Check, ChevronDown, ChevronRight, GitBranch, LayoutDashboard, LogOut, Plus, ScrollText, Server, Settings, ShieldCheck } from 'lucide-react';
import { api } from '~/lib/api';
import { signOut, clearSession, getSessionToken } from '~/lib/auth-client';

interface Project { id: string; name: string; slug: string; }
interface SessionUser { user: { id: string; email: string; name: string | null }; }

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/dashboard/services', label: 'Services', icon: Server },
  { to: '/dashboard/detections', label: 'Detections', icon: BrainCircuit },
  { to: '/dashboard/investigations', label: 'Investigations', icon: ShieldCheck },
  { to: '/dashboard/errors', label: 'Errors', icon: AlertTriangle },
  { to: '/dashboard/logs', label: 'Logs', icon: ScrollText },
  { to: '/dashboard/traces', label: 'Traces', icon: GitBranch },
];

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { open, close } = useSidebar();
  const { orgId, projectId, setProjectId } = useProject();
  const token = getSessionToken();
  const [createOpen, setCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [error, setError] = useState('');

  const projects = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!orgId,
  });

  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<SessionUser>('/auth/session'),
    enabled: !!token,
    retry: false,
  });

  const createProject = useMutation({
    mutationFn: (input: { name: string; slug: string }) => api.post<Project>('/projects', input),
    onSuccess: (project) => {
      setProjectId(project.id);
      setProjectName('');
      setProjectSlug('');
      setError('');
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['projects', orgId] });
      void navigate({ to: '/dashboard/projects/$projectSlug', params: { projectSlug: project.slug } });
      close();
    },
    onError: (err: Error) => setError(err.message),
  });

  const currentProject = projects.data?.find((project) => project.id === projectId);
  const userName = session.data?.user?.name || session.data?.user?.email || 'User';
  const userInitial = userName.charAt(0).toUpperCase();

  function submitProject(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const name = projectName.trim();
    const slug = projectSlug.trim() || slugify(name);
    if (!name || !slug) {
      setError('Enter a project name.');
      return;
    }
    createProject.mutate({ name, slug });
  }

  async function handleSignOut() {
    if (token) await signOut(token);
    clearSession();
    void navigate({ to: '/login' });
  }

  function selectProject(project: Project) {
    setProjectId(project.id);
    void navigate({ to: '/dashboard/projects/$projectSlug', params: { projectSlug: project.slug } });
    close();
  }

  return (
    <>
      <div className={open ? 'fixed inset-0 z-40 bg-[#182012]/30 lg:hidden' : 'hidden'} onClick={close} aria-hidden="true" />
      <aside
        className={cn(
          'w-60 border-r bg-card flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Primary navigation"
      >
        <div className="flex-1 overflow-y-auto px-3 pt-5 pb-3">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Monitor</p>
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
                    active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-sm font-semibold">
                  {currentProject?.name?.charAt(0).toUpperCase() || <Plus className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium">{currentProject?.name || 'Select project'}</span>
                  <span className="block truncate text-xs text-muted-foreground">Project</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuGroup>
                {projects.data?.map((project) => (
                  <DropdownMenuItem key={project.id} onClick={() => selectProject(project)}>
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-secondary text-xs font-semibold">
                      {project.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    {project.id === projectId && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              {projects.data?.length ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create project
              </DropdownMenuItem>
              {currentProject ? (
                <DropdownMenuItem onClick={() => void navigate({ to: '/dashboard/projects/$projectSlug/settings', params: { projectSlug: currentProject.slug } })}>
                  <Settings className="h-4 w-4" />
                  Project settings
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="mt-2 h-12 w-full justify-start gap-3 px-2">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-[#C9E7EB] text-[#182012] font-semibold">{userInitial}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium">{userName}</span>
                  <span className="block truncate text-xs text-muted-foreground">Account</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              {session.data?.user && (
                <>
                  <div className="px-2 py-2">
                    <p className="truncate text-sm font-medium">{session.data.user.name || session.data.user.email}</p>
                    {session.data.user.name && <p className="truncate text-xs text-muted-foreground">{session.data.user.email}</p>}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => void navigate({ to: '/dashboard/projects/$projectSlug/settings', params: { projectSlug: currentProject?.slug || '' } })} disabled={!currentProject}>
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <Dialog open={createOpen} onOpenChange={(next) => { setCreateOpen(next); if (!next) setError(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>Create a project and start sending telemetry to it.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitProject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sidebar-project-name">Project name</Label>
              <Input id="sidebar-project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Payments API" required maxLength={100} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sidebar-project-slug">Slug</Label>
              <Input id="sidebar-project-slug" value={projectSlug} onChange={(event) => setProjectSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="payments-api" pattern="[a-z0-9-]+" />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createProject.isPending}>
                {createProject.isPending ? 'Creating...' : 'Create project'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
