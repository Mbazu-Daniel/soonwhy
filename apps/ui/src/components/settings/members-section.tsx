import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { QueryErrorState } from '~/components/query-error-state';
import { useSettingsMemberContext, useSettingsMembers } from './organization-section';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | Date;
  createdAt?: string | Date;
}

interface SessionUser {
  user: { id: string; email: string; name: string | null; emailVerified?: boolean; image?: string | null };
}

export function MembersSection() {
  const queryClient = useQueryClient();
  const { orgId } = useProject();
  const { canManage } = useSettingsMemberContext(orgId);
  const members = useSettingsMembers(orgId);

  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<SessionUser>('/auth/session'),
    retry: false,
  });

  const invitations = useQuery({
    queryKey: ['organization-invitations', orgId],
    queryFn: () => api.get<Invitation[]>(`/organization/${encodeURIComponent(orgId ?? '')}/invitations`),
    enabled: !!orgId && canManage,
  });

  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviteOpen, setInviteOpen] = useState(false);

  const invite = useMutation({
    mutationFn: (input: { email: string; role: 'member' | 'admin' }) =>
      api.post<Invitation>(`/organization/${encodeURIComponent(orgId ?? '')}/invitations`, input),
    onSuccess: (invitation) => {
      setEmail('');
      setInviteRole('member');
      setInviteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['organization-invitations', orgId] });
      toast.success(`Invitation sent to ${invitation.email}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelInvitation = useMutation({
    mutationFn: (invitationId: string) =>
      api.delete(`/organization/${encodeURIComponent(orgId ?? '')}/invitations/${encodeURIComponent(invitationId)}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organization-invitations', orgId] });
      toast.success('Invitation canceled');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function submitInvite(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    invite.mutate({ email: trimmed, role: inviteRole });
  }

  async function copyInviteLink(invitationId: string) {
    const link = `${window.location.origin}/accept-invitation/${invitationId}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invitation link copied');
    } catch {
      toast.error('Could not copy the link. Copy it from the address bar instead.');
    }
  }

  const pendingInvitations = invitations.data ?? [];

  return (
    <div className="w-full">
      <Card className="border-[#242426] bg-[#0B0B0C] shadow-none">
        <CardContent className="divide-y divide-[#242426] p-0">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <p className="text-sm font-medium">
              Members
              {members.data && <span className="ml-2 rounded-full bg-[#242426] px-2 py-0.5 text-xs font-medium text-[#989898]">{members.data.length}</span>}
            </p>
            {canManage && (
              <Button size="sm" className="h-9" onClick={() => setInviteOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />Add member
              </Button>
            )}
          </div>

          {canManage && (pendingInvitations.length > 0 || invitations.isLoading) && (
            <>
              <div className="flex items-center gap-2 bg-[#0E0E10] px-5 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-[#6E6E70]">Pending invitations{pendingInvitations.length > 0 && ` (${pendingInvitations.length})`}</p>
              </div>
              {invitations.isLoading ? (
                <div className="px-5 py-4 text-sm text-[#989898]">Loading invitations…</div>
              ) : (
                pendingInvitations.map((invitation) => (
                  <div key={invitation.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#151517] text-xs font-semibold text-[#ACFC15]">
                      {invitation.email.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{invitation.email}</span>
                      <span className="block truncate text-xs text-[#989898]">
                        {invitation.role} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                      </span>
                    </span>
                    <Button variant="ghost" size="sm" aria-label={`Copy invitation link for ${invitation.email}`} className="text-[#989898] hover:text-[#F6F6F6]" onClick={() => void copyInviteLink(invitation.id)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Cancel invitation for ${invitation.email}`} className="text-[#989898] hover:text-red-300" onClick={() => cancelInvitation.mutate(invitation.id)} disabled={cancelInvitation.isPending}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </>
          )}

          {members.isLoading ? (
            <div className="px-5 py-4 text-sm text-[#989898]">Loading members…</div>
          ) : members.isError ? (
            <div className="px-5 py-4"><QueryErrorState onRetry={() => void members.refetch()} /></div>
          ) : !members.data?.length ? (
            <div className="px-5 py-6 text-center text-sm text-[#989898]">No members yet.</div>
          ) : (
            members.data.map((member) => {
              const label = member.name || member.user.name || member.user.email;
              const initial = label.charAt(0).toUpperCase();
              const isSelf = member.userId === session.data?.user?.id;
              return (
                <div key={member.id} className="flex items-center gap-3 px-5 py-3">
                  {member.avatar ? (
                    <img src={member.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#151517] text-xs font-semibold text-[#ACFC15]">{initial}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{label}{isSelf && <span className="text-[#6E6E70]"> (you)</span>}</span>
                    <span className="block truncate text-xs text-[#989898]">{member.user.email}</span>
                  </span>
                  <Badge variant="outline" className="border-[#242426] text-[#989898]">{member.role}</Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) { setEmail(''); setInviteRole('member'); } }}>
        <DialogContent className="border-[#242426] bg-[#141414] text-[#F6F6F6]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-[#ACFC15]" />Add member</DialogTitle>
            <DialogDescription className="text-[#989898]">
              They get an invite link by email.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" required autoFocus placeholder="teammate@company.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={invite.isPending} className="border-[#242426] bg-[#151517]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as 'member' | 'admin')} disabled={invite.isPending}>
                <SelectTrigger id="invite-role" className="h-9 w-full border-[#242426] bg-[#151517] text-[#F6F6F6]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#242426] bg-[#151517] text-[#F6F6F6]">
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="border-[#242426] bg-[#151517] text-[#F6F6F6] hover:bg-[#1A1A1C]" onClick={() => setInviteOpen(false)} disabled={invite.isPending}>Cancel</Button>
              <Button type="submit" disabled={invite.isPending || !email.trim()}>
                {invite.isPending ? 'Sending...' : 'Send invite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
