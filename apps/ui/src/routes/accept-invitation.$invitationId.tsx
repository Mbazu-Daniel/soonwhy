import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, Loader2, MailWarning } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { api, apiProblem } from '~/lib/api';
import { setReturnPath } from '~/lib/return-path';
import { getSessionToken, clearSession, signOut } from '~/lib/auth-client';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/accept-invitation/$invitationId')({
  component: AcceptInvitationPage,
});

interface SessionUser {
  user: { id: string; email: string; name: string | null };
}

interface InvitationDetails {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  inviterEmail: string;
  status: string;
}

interface AcceptResponse {
  invitation?: { id: string; organizationId: string; organizationSlug?: string };
  member?: { id: string; userId: string; organizationId: string };
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

function AcceptInvitationPage() {
  const { invitationId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setOrganization } = useProject();
  const token = getSessionToken();

  useEffect(() => {
    if (!token) setReturnPath(window.location.pathname);
  }, [token]);

  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<SessionUser>('/auth/session'),
    enabled: !!token,
    retry: false,
  });

  const invitation = useQuery({
    queryKey: ['invitation', invitationId],
    queryFn: () => api.get<InvitationDetails>(`/auth/invitations/${encodeURIComponent(invitationId)}`),
    enabled: !!token && !!session.data,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api.post<AcceptResponse>('/auth/invitations/accept', { invitationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      const organizations = await queryClient.fetchQuery({
        queryKey: ['organizations'],
        queryFn: () => api.get<Organization[]>('/organizations'),
      });
      const invitationOrgId = invitation.data?.organizationId;
      const match = organizations?.find((item) => item.id === invitationOrgId);
      const target = match ?? organizations?.[0];
      if (target) {
        setOrganization({ id: target.id, slug: target.slug });
        void navigate({ to: '/$organizationSlug', params: { organizationSlug: target.slug } });
        return;
      }
      void navigate({ to: '/organizations' });
    },
  });

  async function signOutToContinue() {
    if (token) await signOut(token);
    clearSession();
    setReturnPath(window.location.pathname);
    void navigate({ to: '/login' });
  }

  if (!token) {
    return (
      <AcceptShell
        icon={<Building2 className="h-6 w-6 text-[#ACFC15]" />}
        title="Sign in to accept your invitation"
        subtitle="You need to sign in (or create an account) with the invited email address to join the organization."
      >
        <Button className="h-11 w-full bg-[#8BD125] text-[#182012] hover:bg-[#9BE33C]" onClick={() => void navigate({ to: '/login' })}>Sign in</Button>
      </AcceptShell>
    );
  }

  if (session.isLoading || invitation.isLoading) {
    return (
      <AcceptShell icon={<Loader2 className="h-6 w-6 animate-spin text-[#ACFC15]" />} title="Loading invitation…" subtitle="Checking your invitation.">
        <span />
      </AcceptShell>
    );
  }

  const invitationProblem = apiProblem(invitation.error);
  const notRecipient = invitationProblem.status === 403;

  if (invitation.isError) {
    if (notRecipient) {
      return (
        <AcceptShell
          icon={<MailWarning className="h-6 w-6 text-amber-400" />}
          title="This invitation is for another email"
          subtitle={`You are signed in as ${session.data?.user?.email ?? 'an unknown account'}, but this invitation was sent to a different address. Sign out and sign in with the invited address instead.`}
        >
          <Button className="h-11 w-full bg-[#8BD125] text-[#182012] hover:bg-[#9BE33C]" onClick={() => void signOutToContinue()}>Sign out and switch accounts</Button>
        </AcceptShell>
      );
    }
    return (
      <AcceptShell
        icon={<MailWarning className="h-6 w-6 text-amber-400" />}
        title="Invitation not found"
        subtitle="This invitation is invalid, expired or was already used. Ask an owner or admin to send a new one."
      >
        <Button variant="outline" className="border-[#242426] bg-[#151517] text-[#F6F6F6] hover:bg-[#1A1A1C]" onClick={() => void navigate({ to: '/' })}>Back to Soonwhy</Button>
      </AcceptShell>
    );
  }

  const data = invitation.data;

  return (
    <AcceptShell
      icon={accept.isSuccess ? <CheckCircle2 className="h-6 w-6 text-[#ACFC15]" /> : <Building2 className="h-6 w-6 text-[#ACFC15]" />}
      title={accept.isSuccess ? 'You are in' : `Join ${data?.organizationName ?? 'the organization'}`}
      subtitle={accept.isSuccess ? 'You have been added to the organization.' : `${data?.inviterEmail ?? 'A teammate'} invited ${data?.email} to join “${data?.organizationName}” as ${data?.role}.`}
    >
      {accept.isSuccess ? (
        <Button className="h-11 w-full bg-[#8BD125] text-[#182012] hover:bg-[#9BE33C]" onClick={() => void queryClient.invalidateQueries({ queryKey: ['organizations'] }).then(() => navigate({ to: '/organizations' }))}>Continue</Button>
      ) : (
        <Button
          className="h-11 w-full bg-[#8BD125] text-[#182012] hover:bg-[#9BE33C]"
          disabled={accept.isPending}
          onClick={() => accept.mutate()}
        >
          {accept.isPending ? 'Joining…' : 'Accept invitation'}
        </Button>
      )}
      {accept.isError && <p role="alert" className="mt-3 text-sm text-red-400">{(accept.error as Error).message}</p>}
    </AcceptShell>
  );
}

function AcceptShell({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#040405] px-4 py-10 text-[#F6F6F6]">
      <div className="w-full max-w-md rounded-2xl border border-[#242426] bg-[#0B0B0C] p-8 text-center shadow-none">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#151517]">{icon}</div>
        <h1 className="mt-5 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#989898]">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
