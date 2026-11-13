import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Trash2, UserRoundMinus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { ImageUpload } from '~/components/image-upload';
import { ConfirmDeleteDialog } from '~/components/confirm-delete-dialog';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
}

export interface SettingsMember {
  id: string;
  userId: string;
  role: string;
  name?: string | null;
  avatar?: string | null;
  user: { id: string; name: string | null; email: string };
}

export function useSettingsMemberContext(orgId: string | null) {
  const memberContext = useQuery({
    queryKey: ['member-context', orgId],
    queryFn: () => api.get<{ role: string }>('/member-context'),
    enabled: !!orgId,
    retry: false,
    staleTime: 300_000,
  });
  const role = memberContext.data?.role;
  const canManage = role === 'owner' || role === 'admin';
  const isOwner = role === 'owner';
  return { role, canManage, isOwner, memberContext };
}

export function useSettingsMembers(orgId: string | null) {
  return useQuery({
    queryKey: ['organization-members', orgId],
    queryFn: () => api.get<SettingsMember[]>(`/organization/${encodeURIComponent(orgId ?? '')}/members`),
    enabled: !!orgId,
  });
}

export function OrganizationSection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orgId, orgSlug, clearProjectId } = useProject();

  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<Organization[]>('/organizations'),
    retry: false,
  });
  const organization = organizations.data?.find((item) => item.slug === orgSlug);

  const { canManage, isOwner } = useSettingsMemberContext(orgId);
  const members = useSettingsMembers(orgId);

  const [name, setName] = useState('');
  useEffect(() => {
    if (organization?.name) setName(organization.name);
  }, [organization?.name]);

  const rename = useMutation({
    mutationFn: (input: { name: string }) =>
      api.put<Organization>(`/organization/${encodeURIComponent(orgId ?? '')}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organization updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeOrganization = useMutation({
    mutationFn: () => api.delete(`/organization/${encodeURIComponent(orgId ?? '')}`),
    onSuccess: async () => {
      clearProjectId();
      setDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organization deleted');
      void navigate({ to: '/organizations' });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const transfer = useMutation({
    mutationFn: (memberId: string) =>
      api.post(`/organization/${encodeURIComponent(orgId ?? '')}/transfer`, { memberId }),
    onSuccess: async () => {
      setTransferOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organization-members', orgId] }),
        queryClient.invalidateQueries({ queryKey: ['member-context', orgId] }),
        queryClient.invalidateQueries({ queryKey: ['organizations'] }),
      ]);
      toast.success('Ownership transferred. You are now an admin.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [transferMemberId, setTransferMemberId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const transferTargets = (members.data ?? []).filter(
    (member) => !(member.role ?? '').split(',').map((part) => part.trim()).includes('owner'),
  );
  const selectedTarget = transferTargets.find((member) => member.id === transferMemberId) ?? null;

  const trimmedName = name.trim();
  const canSave = canManage && !!trimmedName && trimmedName !== (organization?.name ?? '') && !rename.isPending;

  function submitRename(event: FormEvent) {
    event.preventDefault();
    if (!trimmedName || trimmedName === organization?.name) return;
    rename.mutate({ name: trimmedName });
  }

  return (
    <div className="w-full space-y-6">
      <Card className="border-[#242426] bg-[#0B0B0C] shadow-none">
        <CardContent className="divide-y divide-[#242426] p-0">
          <div className="flex items-center gap-4 px-5 py-5">
            <ImageUpload
              kind="organization_logo"
              size="lg"
              shape="square"
              imageUrl={organization?.logo ?? null}
              fallback={organization?.name?.charAt(0).toUpperCase() ?? 'O'}
              disabled={!canManage || !organization}
              onUploaded={() => void queryClient.invalidateQueries({ queryKey: ['organizations'] })}
            />
            <p className="min-w-0 truncate text-base font-semibold">{organization?.name ?? 'Organization'}</p>
          </div>

          <form onSubmit={submitRename} className="space-y-2 px-5 py-4">
            <Label htmlFor="organization-name">Name</Label>
            <div className="flex items-center gap-2">
              <Input id="organization-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} disabled={!canManage || !organization} className="h-9 min-w-0 flex-1 border-[#242426] bg-[#151517]" />
              <Button type="submit" size="sm" className="h-9" disabled={!canSave}>{rename.isPending ? 'Saving...' : 'Save'}</Button>
            </div>
            {rename.isError && <p className="text-sm text-red-400">Could not save the organization. Try again.</p>}
          </form>

          {isOwner && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Transfer ownership</p>
                <p className="text-xs text-[#6E6E70]">{transferTargets.length === 0 ? 'Invite a member first.' : 'You become an admin.'}</p>
              </div>
              <Button variant="outline" size="sm" className="h-9 border-[#242426] bg-[#151517] text-[#F6F6F6] hover:bg-[#1A1A1C]" onClick={() => setTransferOpen(true)} disabled={transferTargets.length === 0}>
                <Crown className="mr-2 h-4 w-4" />Transfer
              </Button>
            </div>
          )}
          {!isOwner && (
            <div className="flex items-center gap-2 px-5 py-4">
              <UserRoundMinus className="h-4 w-4 shrink-0 text-[#6E6E70]" />
              <p className="text-sm text-[#989898]">Only the owner can transfer or delete this organization.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="border-red-950/60 bg-[#0B0B0C] shadow-none">
          <CardContent className="p-0">
            <p className="border-b border-red-950/60 px-5 pb-2 pt-3 text-xs font-medium uppercase tracking-wide text-red-400/80">Danger zone</p>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <p className="text-sm font-medium text-red-400">Delete organization</p>
              <Button variant="outline" size="sm" className="h-9 border-red-900/60 bg-red-950/30 text-red-300 hover:bg-red-950/60 hover:text-red-200" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="border-[#242426] bg-[#141414] text-[#F6F6F6]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-[#ACFC15]" />Transfer ownership</DialogTitle>
            <DialogDescription className="text-[#989898]">
              Choose who becomes the new owner of <span className="font-medium text-[#F6F6F6]">{organization?.name}</span>. You will become an admin after the transfer.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {transferTargets.map((member) => {
              const label = member.name || member.user.name || member.user.email;
              const checked = transferMemberId === member.id;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setTransferMemberId(member.id)}
                  aria-pressed={checked}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${checked ? 'border-[#ACFC15]/50 bg-[#ACFC15]/5' : 'border-[#242426] bg-[#151517] hover:border-[#3A3A3C]'}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0B0B0C] text-xs font-semibold text-[#ACFC15]">{label.charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{label}</span>
                    <span className="block truncate text-xs text-[#989898]">{member.user.email}</span>
                  </span>
                  <Badge variant="outline" className="border-[#242426] text-[#989898]">{member.role}</Badge>
                </button>
              );
            })}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-[#242426] bg-[#151517]" onClick={() => setTransferOpen(false)} disabled={transfer.isPending}>Cancel</Button>
            <Button onClick={() => selectedTarget && transfer.mutate(selectedTarget.id)} disabled={!selectedTarget || transfer.isPending}>
              {transfer.isPending ? 'Transferring...' : 'Transfer ownership'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {organization && (
        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete organization"
          description="Deletes all projects, telemetry and settings. This cannot be undone."
          confirmationText={organization.slug}
          confirmLabel="Delete organization"
          pending={removeOrganization.isPending}
          error={removeOrganization.isError ? (removeOrganization.error as Error).message : null}
          onConfirm={() => removeOrganization.mutate()}
        />
      )}
    </div>
  );
}
