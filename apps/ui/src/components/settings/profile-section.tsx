import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, LogOut, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '~/lib/api';
import { clearSession, getSessionToken, signOut } from '~/lib/auth-client';
import { useProject } from '~/lib/project-context';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { ImageUpload } from '~/components/image-upload';
import { useSettingsMembers } from './organization-section';

interface SessionUser {
  user: { id: string; email: string; name: string | null; emailVerified?: boolean; image?: string | null };
}

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

export function ProfileSection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = getSessionToken();
  const { orgId, orgSlug, projectId, projectSlug } = useProject();

  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<SessionUser>('/auth/session'),
    enabled: !!token,
    retry: false,
  });
  const members = useSettingsMembers(orgId);
  const ownMember = members.data?.find((member) => member.userId === session.data?.user?.id);
  const memberLabel = ownMember?.name || ownMember?.user.name || ownMember?.user.email || session.data?.user?.name || session.data?.user?.email || '?';

  const [name, setName] = useState('');
  useEffect(() => {
    if (ownMember) setName(ownMember.name ?? ownMember.user.name ?? '');
    else if (!members.isLoading && session.data) setName(session.data.user?.name ?? '');
  }, [ownMember, members.isLoading, session.data]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<Organization[]>('/organizations'),
    enabled: deleteOpen,
    retry: false,
  });
  const projects = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: deleteOpen && !!orgId,
    retry: false,
  });
  const organization = organizations.data?.find((item) => item.slug === orgSlug);
  const project = projects.data?.find((item) => (projectId ? item.id === projectId : item.slug === projectSlug));

  const saveName = useMutation({
    mutationFn: (input: { name: string }) =>
      api.put(`/organization/${encodeURIComponent(orgId ?? '')}/member-profile`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organization-members', orgId] });
      toast.success('Display name updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteAccount = useMutation({
    mutationFn: (input: { password?: string }) => api.post('/auth/delete-account', input),
    onSuccess: () => {
      clearSession();
      setDeleteOpen(false);
      void navigate({ to: '/login' });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const trimmedName = name.trim();
  const currentName = ownMember?.name ?? ownMember?.user.name ?? session.data?.user?.name ?? '';
  const canSave = !!trimmedName && trimmedName !== currentName && !saveName.isPending && !!ownMember;
  const email = session.data?.user?.email ?? '';
  const emailMatches = confirmEmail.trim().toLowerCase() === email.toLowerCase();

  function submitRename(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    saveName.mutate({ name: trimmedName });
  }

  async function handleSignOut() {
    if (token) await signOut(token);
    clearSession();
    void navigate({ to: '/login' });
  }

  async function copyValue(value: string | null | undefined, key: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(key);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  function submitDeleteAccount(event: FormEvent) {
    event.preventDefault();
    if (!emailMatches || deleteAccount.isPending) return;
    deleteAccount.mutate({ password: password || undefined });
  }

  return (
    <div className="w-full">
      <Card className="border-[#242426] bg-[#0B0B0C] shadow-none">
        <CardContent className="divide-y divide-[#242426] p-0">
          <div className="flex items-center gap-4 px-5 py-4">
            <ImageUpload
              kind="member_avatar"
              size="md"
              shape="circle"
              targetId={ownMember?.id}
              imageUrl={ownMember?.avatar ?? null}
              fallback={memberLabel.charAt(0).toUpperCase()}
              disabled={!ownMember}
              onUploaded={() => void queryClient.invalidateQueries({ queryKey: ['organization-members', orgId] })}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{memberLabel === '?' ? 'Unnamed member' : memberLabel}</p>
              <p className="truncate text-xs text-[#989898]">{email || '—'}</p>
            </div>
            {session.data?.user && (
              <Badge variant="outline" className={session.data.user.emailVerified ? 'border-[#3A3A3C] text-[#ACFC15]' : 'border-[#242426] text-[#989898]'}>
                {session.data.user.emailVerified ? 'Verified' : 'Unverified'}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <Label htmlFor="profile-name" className="text-sm font-medium">Display name</Label>
            <form onSubmit={submitRename} className="flex items-center gap-2">
              <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} disabled={!ownMember || saveName.isPending} className="h-9 w-44 border-[#242426] bg-[#151517] sm:w-64" />
              <Button type="submit" size="sm" className="h-9" disabled={!canSave}>{saveName.isPending ? 'Saving...' : 'Save'}</Button>
            </form>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <Label htmlFor="profile-email" className="text-sm font-medium">Email</Label>
            <Input id="profile-email" value={email} disabled className="h-9 w-44 border-[#242426] bg-[#151517] text-[#6E6E70] sm:w-64" />
          </div>

          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <p className="text-sm font-medium">Session</p>
            <Button variant="outline" size="sm" className="h-9 border-[#242426] bg-[#151517] text-[#F6F6F6] hover:bg-[#1A1A1C]" onClick={() => void handleSignOut()}>
              <LogOut className="mr-2 h-4 w-4" />Sign out
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <p className="text-sm font-medium text-red-400">Delete account</p>
            <Button variant="outline" size="sm" className="h-9 border-red-900/60 bg-red-950/30 text-red-300 hover:bg-red-950/60 hover:text-red-200" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) { setConfirmEmail(''); setPassword(''); } }}>
        <DialogContent className="border-[#2B1A1A] bg-[#140C0C] text-[#F6F6F6]">
          <DialogHeader>
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-red-950/50 text-red-400"><Trash2 className="h-5 w-5" /></div>
            <DialogTitle>Delete your account</DialogTitle>
            <DialogDescription className="text-[#989898]">
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitDeleteAccount} className="space-y-4">
            <div className="space-y-2 rounded-lg border border-[#2B1A1A] bg-[#0B0B0C] p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[#6E6E70]">Current workspace</p>
              {[
                { key: 'organization', label: 'Organization', name: organization?.name, slug: organization?.slug ?? orgSlug },
                { key: 'project', label: 'Project', name: project?.name, slug: project?.slug ?? projectSlug },
              ].map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#6E6E70]">{row.label}</p>
                    <p className="truncate text-sm text-[#F6F6F6]">{row.name ?? row.slug ?? '—'}</p>
                    <code className="font-mono text-xs text-[#989898]">{row.slug ?? '—'}</code>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-[#989898] hover:bg-[#1A1A1C] hover:text-[#F6F6F6]"
                    onClick={() => void copyValue(row.slug, row.key, `${row.label} slug`)}
                    disabled={!row.slug}
                    aria-label={`Copy ${row.label.toLowerCase()} slug`}
                  >
                    {copied === row.key ? <Check className="h-4 w-4 text-[#ACFC15]" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-account-email" className="text-[#C9C9CB]">
                Type <code className="rounded bg-[#241616] px-1.5 py-0.5 font-mono text-xs text-red-300">{email}</code> to confirm
              </Label>
              <Input
                id="delete-account-email"
                type="email"
                autoComplete="off"
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
                placeholder={email}
                className="border-[#2B1A1A] bg-[#0B0B0C]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-account-password" className="text-[#C9C9CB]">Password <span className="text-[#6E6E70]">(if you sign in with a password)</span></Label>
              <Input
                id="delete-account-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Leave blank for social sign-in"
                className="border-[#2B1A1A] bg-[#0B0B0C]"
              />
            </div>
            {deleteAccount.isError && <p role="alert" className="text-sm text-red-400">{(deleteAccount.error as Error).message}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="border-[#242426] bg-[#151517] text-[#F6F6F6] hover:bg-[#1A1A1C]" onClick={() => setDeleteOpen(false)} disabled={deleteAccount.isPending}>Cancel</Button>
              <Button type="submit" disabled={!emailMatches || deleteAccount.isPending} className="bg-red-600 text-white hover:bg-red-500 disabled:opacity-40">
                {deleteAccount.isPending ? 'Deleting...' : 'Delete account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
