import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Activity, CheckCircle2, ShieldAlert, Wifi, XCircle, Plus, Users, Layers3, CreditCard, UserMinus } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { QueryErrorState } from '~/components/query-error-state';

export const Route = createFileRoute('/$organizationSlug/settings')({
  component: SettingsPage,
});

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

interface TelemetryStatus {
  status: 'healthy' | 'stale' | 'waiting';
  hasTelemetry: boolean;
  lastTelemetryAt: string | null;
  lastTelemetryAgeMs: number | null;
  lastService: string | null;
  lastTraceId: string | null;
}

function SettingsPage() {
  const { orgId, projectId } = useProject();

  const projects = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!orgId,
  });
  const project = projects.data?.find((item) => item.id === projectId);

  if (!projectId) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="font-medium">Choose a project</p>
          <p className="mt-1 text-sm text-muted-foreground">Select a project before managing telemetry setup.</p>
        </CardContent>
      </Card>
    );
  }

  if (projects.isError) return <QueryErrorState onRetry={() => void projects.refetch()} />;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <h1 className="sr-only">Settings</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <TelemetryCard projectId={projectId} />
      </div>

      <Card className="border-[#242426] bg-[#0B0B0C] shadow-none">
        <CardHeader>
          <CardTitle>Project</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Project name</p>
            <p className="mt-1 font-medium">{project?.name ?? 'Loading…'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Project ID</p>
            <code className="mt-1 block break-all rounded-md bg-[#151517] px-3 py-2 font-mono text-xs">{projectId}</code>
          </div>
          {project?.slug && (
            <div>
              <p className="text-xs text-muted-foreground">Slug</p>
              <p className="mt-1 font-mono text-sm">{project.slug}</p>
            </div>
          )}
          <div className="sm:text-right">
            <Link to="/onboarding" className="text-sm font-medium text-[#16931F] hover:underline">
              Open setup flow
            </Link>
          </div>
        </CardContent>
      </Card>

      <PlatformControls projectId={projectId} orgId={orgId} />
      <OrganizationMembers orgId={orgId} />
      <SetupGuidance />
    </div>
  );
}

function TelemetryCard({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['telemetry-status', projectId],
    queryFn: () => api.get<TelemetryStatus>(`/telemetry-status?projectId=${encodeURIComponent(projectId)}`),
    enabled: !!projectId,
    refetchInterval: 15_000,
  });

  if (isError) {
    return (
      <Card className="border-red-200 bg-[#0B0B0C] shadow-none md:col-span-3">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Telemetry status unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">We could not verify recent ingestion.</p>
          </div>
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const label = data?.status === 'healthy' ? 'Receiving telemetry' : data?.status === 'stale' ? 'Telemetry is stale' : 'Waiting for telemetry';
  const Icon = data?.status === 'healthy' ? CheckCircle2 : data?.status === 'stale' ? ShieldAlert : Wifi;

  return (
    <>
      <StatusMetric icon={Icon} label="Ingestion health" value={isLoading ? 'Checking…' : label} />
      <StatusMetric
        icon={Activity}
        label="Last telemetry"
        value={isLoading ? 'Checking…' : formatAge(data?.lastTelemetryAt)}
        detail={data?.lastTelemetryAt ? new Date(data.lastTelemetryAt).toLocaleString() : 'No request telemetry received yet'}
      />
      <StatusMetric
        icon={data?.hasTelemetry ? CheckCircle2 : XCircle}
        label="First trace"
        value={data?.hasTelemetry ? 'Confirmed' : 'Not received'}
        detail={data?.lastTraceId ? `Latest trace ${data.lastTraceId.slice(0, 12)}…` : 'Send a request to confirm the pipeline'}
      />
    </>
  );
}

function StatusMetric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail?: string }) {
  return (
    <Card className="border-[#242426] bg-[#0B0B0C] shadow-none">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-[#16931F]" aria-hidden="true" />
        </div>
        <p className="mt-2 text-lg font-semibold">{value}</p>
        {detail && <p className="mt-1 break-words text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function PlatformControls({ projectId, orgId }: { projectId: string; orgId: string | null }) {
  const [teamName, setTeamName] = useState('');
  const [teamSlug, setTeamSlug] = useState('');
  const [environmentName, setEnvironmentName] = useState('');
  const [environmentSlug, setEnvironmentSlug] = useState('');
  const teams = useQuery({ queryKey: ['teams', orgId], queryFn: () => api.get<Array<{ id: string; name: string; slug: string }>>('/teams'), enabled: !!orgId });
  const environments = useQuery({ queryKey: ['environments', projectId], queryFn: () => api.get<Array<{ id: string; name: string; slug: string; kind: string }>>(`/environments?projectId=${encodeURIComponent(projectId)}`), enabled: !!projectId });
  const billing = useQuery({ queryKey: ['billing-dashboard', orgId, projectId], queryFn: () => api.get<{ subscription?: { plan?: { name?: string } }; usage: Array<{ metric: string; quantity: number }>; quotas: Array<{ metric: string; limit: number | null }> }>(`/billing/dashboard?projectId=${encodeURIComponent(projectId)}`), enabled: !!orgId });
  const createTeam = useMutation({ mutationFn: () => api.post('/teams', { name: teamName.trim(), slug: teamSlug.trim() }), onSuccess: () => { setTeamName(''); setTeamSlug(''); void teams.refetch(); } });
  const createEnvironment = useMutation({ mutationFn: () => api.post(`/environments?projectId=${encodeURIComponent(projectId)}`, { name: environmentName.trim(), slug: environmentSlug.trim(), kind: 'production' }), onSuccess: () => { setEnvironmentName(''); setEnvironmentSlug(''); void environments.refetch(); } });
  return <section className="grid gap-4 lg:grid-cols-3">
    <Card className="border-[#242426] bg-[#0B0B0C] shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-[#ACFC15]" />Teams</CardTitle></CardHeader><CardContent className="space-y-3"><div className="space-y-2"><Input placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} /><Input placeholder="team-slug" value={teamSlug} onChange={(e) => setTeamSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} /></div><Button size="sm" onClick={() => createTeam.mutate()} disabled={!teamName.trim() || !teamSlug.trim() || createTeam.isPending}><Plus className="mr-2 h-3.5 w-3.5" />Add team</Button><div className="space-y-1 border-t border-[#242426] pt-3">{teams.data?.map((team) => <div key={team.id} className="flex items-center justify-between text-xs"><span>{team.name}</span><span className="font-mono text-[#6E6E70]">{team.slug}</span></div>)}</div></CardContent></Card>
    <Card className="border-[#242426] bg-[#0B0B0C] shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Layers3 className="h-4 w-4 text-[#ACFC15]" />Environments</CardTitle></CardHeader><CardContent className="space-y-3"><div className="space-y-2"><Input placeholder="Environment name" value={environmentName} onChange={(e) => setEnvironmentName(e.target.value)} /><Input placeholder="production" value={environmentSlug} onChange={(e) => setEnvironmentSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} /></div><Button size="sm" onClick={() => createEnvironment.mutate()} disabled={!environmentName.trim() || !environmentSlug.trim() || createEnvironment.isPending}><Plus className="mr-2 h-3.5 w-3.5" />Add environment</Button><div className="space-y-1 border-t border-[#242426] pt-3">{environments.data?.map((environment) => <div key={environment.id} className="flex items-center justify-between text-xs"><span>{environment.name}</span><span className="rounded-full border border-[#242426] px-2 py-0.5 text-[#989898]">{environment.kind}</span></div>)}</div></CardContent></Card>
    <Card className="border-[#242426] bg-[#0B0B0C] shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4 text-[#ACFC15]" />Usage & billing</CardTitle></CardHeader><CardContent><p className="text-xs text-[#989898]">Current plan</p><p className="mt-1 text-lg font-semibold">{billing.data?.subscription?.plan?.name ?? 'No subscription'}</p><div className="mt-4 space-y-2">{billing.data?.usage?.slice(0, 4).map((item) => { const quota = billing.data?.quotas?.find((q) => q.metric === item.metric)?.limit; return <div key={item.metric} className="flex items-center justify-between text-xs"><span className="text-[#989898]">{item.metric}</span><span className="font-mono">{item.quantity.toLocaleString()}{quota != null ? ` / ${quota.toLocaleString()}` : ''}</span></div>; })}</div><p className="mt-4 text-[11px] text-[#6E6E70]">Billing data is already organization-scoped. This surface makes the existing API visible in the product.</p></CardContent></Card>
  </section>;
}

function OrganizationMembers({ orgId }: { orgId: string | null }) {
  const members = useQuery({
    queryKey: ['organization-members', orgId],
    queryFn: () => api.get<Array<{ id: string; userId: string; role: string; user: { id: string; name: string | null; email: string } }>>(`/organization/${orgId}/members`),
    enabled: !!orgId,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api.delete(`/organization/${orgId}/members/${encodeURIComponent(userId)}`),
    onSuccess: () => void members.refetch(),
  });

  return (
    <Card className="border-[#242426] bg-[#0B0B0C] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-[#ACFC15]" />Organization members</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {members.isLoading ? <div className="p-5 text-sm text-[#989898]">Loading members…</div> :
          members.isError ? <div className="p-5"><QueryErrorState onRetry={() => void members.refetch()} /></div> :
          !members.data?.length ? <div className="p-8 text-center text-sm text-[#989898]">No members found.</div> :
          <div className="divide-y divide-[#242426]">{members.data.map(member => <div key={member.id} className="flex items-center gap-4 p-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">{(member.user.name ?? member.user.email).slice(0,1).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.user.name ?? member.user.email}</p><p className="truncate text-xs text-[#989898]">{member.user.email}</p></div>
            <Badge variant="outline">{member.role}</Badge>
            {member.role !== 'owner' && <Button variant="ghost" size="sm" className="text-[#8A1C13]" onClick={() => remove.mutate(member.userId)} disabled={remove.isPending}><UserMinus className="mr-2 h-3.5 w-3.5" />Remove</Button>}
          </div>)}</div>}
      </CardContent>
    </Card>
  );
}

function SetupGuidance() {
  return (
    <Card className="border-[#242426] bg-[#151517] shadow-none">
      <CardHeader><CardTitle>Setup checklist</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ChecklistItem title="Create an ingestion key" detail="Keep the raw key in your application secret manager." />
        <ChecklistItem title="Instrument your application" detail="Use the setup flow for the supported SoonWhy instrumentation entry point." />
        <ChecklistItem title="Send real traffic" detail="A successful request creates the first request and trace evidence." />
        <ChecklistItem title="Verify ingestion" detail="Return here to confirm the latest telemetry timestamp and trace." />
        <Link to="/onboarding" className="inline-flex items-center text-sm font-medium text-[#16931F] hover:underline">Open setup flow</Link>
      </CardContent>
    </Card>
  );
}

function ChecklistItem({ title, detail }: { title: string; detail: string }) {
  return <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16931F]" /><div><p className="font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div></div>;
}

function formatAge(value: string | null | undefined) {
  if (!value) return 'Not received';
  const date = new Date(value);
  const age = Date.now() - date.getTime();
  if (!Number.isFinite(age) || age < 0) return 'Just now';
  const seconds = Math.floor(age / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
