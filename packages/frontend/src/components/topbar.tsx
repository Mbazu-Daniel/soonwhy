import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { api } from '~/lib/api';
import { signOut, clearSession, getSessionToken } from '~/lib/auth-client';
import { LogOut, ChevronDown } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface Environment {
  id: string;
  name: string;
  slug: string;
}

interface SessionUser {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export function TopBar() {
  const navigate = useNavigate();
  const orgId = typeof window !== 'undefined' ? localStorage.getItem('org_id') : null;
  const projectId = typeof window !== 'undefined' ? localStorage.getItem('project_id') : null;
  const token = getSessionToken();

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<SessionUser>('/auth/session'),
    enabled: !!token,
    retry: false,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!orgId,
  });

  const { data: environments } = useQuery({
    queryKey: ['environments', projectId],
    queryFn: () => api.get<Environment[]>(`/environments?projectId=${projectId}`),
    enabled: !!projectId,
  });

  async function handleSignOut() {
    if (token) await signOut(token);
    clearSession();
    navigate({ to: '/auth/sign-in' });
  }

  function handleProjectChange(value: string) {
    localStorage.setItem('project_id', value);
    window.location.reload();
  }

  function handleEnvChange(value: string) {
    localStorage.setItem('env_slug', value);
    window.location.reload();
  }

  const userName = session?.user?.name || session?.user?.email || 'U';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="h-14 border-b flex items-center justify-between px-4 bg-background">
      <div className="flex items-center gap-4">
        <h1 className="font-semibold text-lg">SoonWhy</h1>
        {projects && projects.length > 0 && (
          <Select value={projectId || ''} onValueChange={handleProjectChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {environments && environments.length > 0 && (
          <Select defaultValue="production" onValueChange={handleEnvChange}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Environment" />
            </SelectTrigger>
            <SelectContent>
              {environments.map((e) => (
                <SelectItem key={e.id} value={e.slug}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback>{userInitial}</AvatarFallback>
            </Avatar>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {session?.user && (
            <>
              <div className="px-2 py-1.5 text-sm">
                <p className="font-medium">{session.user.name || session.user.email}</p>
                {session.user.name && (
                  <p className="text-xs text-muted-foreground">{session.user.email}</p>
                )}
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
