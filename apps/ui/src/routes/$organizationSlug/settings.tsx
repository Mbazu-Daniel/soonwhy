import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { Building2, FolderKanban, Users, UserRound, UserMinus, Plus, LogOut } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { getSessionToken, clearSession, signOut } from '~/lib/auth-client';
import { QueryErrorState } from '~/components/query-error-state';
import { CreateProjectDialog } from '~/components/create-project-dialog';

export const Route = createFileRoute('/$organizationSlug/settings')({
  component: SettingsPage,
});

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string | null; email: string };
}

interface SessionUser {
  user: { id: string; email: string; name: string | null; emailVerified?: boolean };
}

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orgId, orgSlug, projectId } = useProject();
  const token = getSessionToken();

  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<Organization[]>('/organizations'),
    enabled: !!token,
    retry: false,
  });
  const organization = organizations.data?.find((item) => item.slug === orgSlug);

  const memberContext = useQuery({
    queryKey: ['member-context', orgId],
    queryFn: () => api.get<{ role: string }>('/member-context'),
    enabled: !!orgId,
    retry: false,
    staleTime: 300_000,
  });
  const canManage = memberContext.data?.role === 'owner' || memberContext.data?.role === 'admin';

  const projects = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!orgId,
  });

  const members = useQuery({
    queryKey: ['organization-members', orgId],
    queryFn: () => api.get<Member[]>(`/organization/${encodeURIComponent(orgId ?? '')}/members`),
    enabled: !!orgId,
  });

  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<SessionUser>('/auth/session'),
    enabled: !!token,
    retry: false,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  useEffect(() => {
    if (organization?.name) setName(organization.name);
  }, [organization?.name]);

  const rename = useMutation({
    mutationFn: (input: { name: string }) =>
      api.put<Organization>(`/organization/${encodeURIComponent(orgId ?? '')}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/organization/${encodeURIComponent(orgId ?? '')}/members/${encodeURIComponent(userId)}`),
    onSuccess: () => {
      void members.refetch();
    },
  });

  function submitRename(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === organization?.name) return;
    rename.mutate({ name: trimmed });
  }

  async function handleSignOut() {
    if (token) await signOut(token);
    clearSession();
    navigate({ to: '/login' });
  }

  const trimmedName = name.trim();
  const canSave = canManage && !!trimmedName && trimmedName !== (organization?.name ?? '') && !rename.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <h1 className="sr-only">Settings</h1>

      <Card className="border-[#242426] bg-[#0B0B0C] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-[#ACFC15]" />Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={submitRename} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="organization-name">Name</Label>
              <Input id="organization-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} disabled={!canManage || !organization} />
              {organization?.slug && <p className="font-mono text-xs text-[#6E6E70]">{organization.slug}</p>}
            </div>
            <Button type="submit" size="sm" className="h-9" disabled={!canSave}>Save</Button>
          </form>
          {rename.isError && <p className="text-sm text-red-400">Could not save the organization. Try again.</p>}
        </CardContent>
      </Card>

      <Card className="border-[#242426] bg-[#0B0B0C] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-[#ACFC15]" />Members{members.data && <span className="rounded-full bg-[#151517] px-2 py-0.5 text-xs font-medium text-[#989898]">{members.data.length}</span>}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.isLoading ? (
            <div className="p-5 text-sm text-[#989898]">Loading members…</div>
          ) : members.isError ? (
            <div className="p-5"><QueryErrorState onRetry={() => void members.refetch()} /></div>
          ) : !members.data?.length ? (
            <div className="p-6 text-center text-sm text-[#989898]">No members yet.</div>
          ) : (
            <div className="divide-y divide-[#242426]">
              {members.data.map((member) => {
                const label = member.user.name || member.user.email;
                const initial = label.charAt(0).toUpperCase();
                return (
                  <div key={member.id} className="flex items-center gap-3 p-4 transition-colors hover:bg-[#151517]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#151517] text-xs font-semibold text-[#ACFC15]">{initial}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{label}</span>
                      <span className="block truncate text-xs text-[#989898]">{member.user.email}</span>
                    </span>
                    <Badge variant="outline" className="border-[#242426] text-[#989898]">{member.role}</Badge>
                    {canManage && member.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${label}`}
                        className="text-red-400 hover:bg-red-950/40 hover:text-red-300"
                        onClick={() => removeMember.mutate(member.userId)}
                        disabled={removeMember.isPending}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#242426] bg-[#0B0B0C] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2"><FolderKanban className="h-4 w-4 text-[#ACFC15]" />Projects</span>
            <Button size="sm" variant="outline" className="h-8 border-[#242426] bg-[#151517]" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />New project
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {projects.isLoading ? (
            <div className="p-5 text-sm text-[#989898]">Loading projects…</div>
          ) : projects.isError ? (
            <div className="p-5"><QueryErrorState onRetry={() => void projects.refetch()} /></div>
          ) : !projects.data?.length ? (
            <div className="p-6 text-center text-sm text-[#989898]">No projects yet.</div>
          ) : (
            <div className="divide-y divide-[#242426]">
              {projects.data.map((project) => {
                const current = project.id === projectId;
                return (
                  <div key={project.id} className="flex items-center gap-3 p-4 transition-colors hover:bg-[#151517]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#151517] text-xs font-semibold text-[#ACFC15]">{project.name.charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{project.name}</span>
                      <span className="block truncate font-mono text-xs text-[#6E6E70]">{project.slug}</span>
                    </span>
                    {current && <Badge variant="outline" className="border-[#3A3A3C] text-[#ACFC15]">Current</Badge>}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#989898] hover:text-[#F6F6F6]"
                      onClick={() => orgSlug && navigate({ to: '/$organizationSlug/p/$projectSlug', params: { organizationSlug: orgSlug, projectSlug: project.slug } })}
                    >
                      Open
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#242426] bg-[#0B0B0C] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4 text-[#ACFC15]" />Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#151517] text-base font-semibold text-[#ACFC15]">
            {(session.data?.user?.name || session.data?.user?.email || '?').charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{session.data?.user?.name || 'Unnamed user'}</span>
            <span className="block truncate text-xs text-[#989898]">{session.data?.user?.email ?? '—'}</span>
          </span>
          <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-950/40 hover:text-red-300" onClick={() => void handleSignOut()}>
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
        </CardContent>
      </Card>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
