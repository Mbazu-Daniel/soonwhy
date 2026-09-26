import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Activity, CheckCircle2, Copy, KeyRound, Loader2, ShieldAlert, Trash2, Wifi, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { QueryErrorState } from '~/components/query-error-state';

export const Route = createFileRoute('/dashboard/projects/$projectSlug/settings')({
  component: SettingsPage,
});

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  key?: string;
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
  const { projectSlug } = Route.useParams();
  const { orgId, projectId } = useProject();
  const queryClient = useQueryClient();

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
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#16931F]">Project setup</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Telemetry setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage ingestion keys, verify telemetry health, and get back to the setup flow.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <TelemetryCard projectId={projectId} />
      </div>

      <Card className="border-border bg-card shadow-none">
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
            <code className="mt-1 block break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">{projectId}</code>
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

      <SetupGuidance />
    </div>
  );
}

function TelemetryCard({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['telemetry-status', projectId],
    queryFn: () => api.get<TelemetryStatus>(`/projects/${projectId}/dashboard/telemetry-status`),
    enabled: !!projectId,
    refetchInterval: 15_000,
  });

  if (isError) {
    return (
      <Card className="border-red-200 bg-card shadow-none md:col-span-3">
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
    <Card className="border-border bg-card shadow-none">
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

export function ApiKeySettings({ projectId, queryClient }: { projectId: string; queryClient: ReturnType<typeof useQueryClient> }) {
  const [name, setName] = useState('Default ingestion key');
  const [newKey, setNewKey] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const keys = useQuery({
    queryKey: ['api-keys', projectId],
    queryFn: () => api.get<ApiKey[]>(`/projects/${projectId}/api-keys`),
  });

  const create = useMutation({
    mutationFn: () => api.post<ApiKey>(`/projects/${projectId}/api-keys`, { name: name.trim() || 'Ingestion key' }),
    onSuccess: (key) => {
      setNewKey(key);
      void queryClient.invalidateQueries({ queryKey: ['api-keys', projectId] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/api-keys/${encodeURIComponent(id)}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['api-keys', projectId] }),
  });

  async function copyKey() {
    if (!newKey?.key) return;
    await navigator.clipboard?.writeText(newKey.key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Ingestion API keys</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Raw keys are shown only once when created.</p>
        </div>
        <div className="flex gap-2">
          <Input aria-label="API key name" value={name} onChange={(event) => setName(event.target.value)} className="w-52" maxLength={100} />
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Create key
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {newKey?.key && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Copy this key now</p>
            <p className="mt-1 text-xs text-amber-800">SoonWhy cannot show the raw key again after you leave this page.</p>
            <div className="mt-3 flex gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md bg-[#182012] px-3 py-2 text-xs text-white">{newKey.key}</code>
              <Button variant="outline" size="icon" aria-label="Copy API key" onClick={() => void copyKey()}><Copy /></Button>
            </div>
            <p className="mt-2 text-xs text-amber-800">{copied ? 'Copied.' : 'Keep this key in your secret manager.'}</p>
          </div>
        )}

        {keys.isError && <QueryErrorState onRetry={() => void keys.refetch()} />}
        {!keys.isLoading && !keys.isError && !keys.data?.length && (
          <div className="rounded-lg border border-dashed border-border bg-muted p-6 text-center">
            <KeyRound className="mx-auto h-6 w-6 text-[#16931F]" />
            <p className="mt-2 text-sm font-medium">No ingestion keys yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Create one to connect an application to this project.</p>
          </div>
        )}
        {keys.data?.map((key) => (
          <div key={key.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{key.name}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{key.prefix}••••••••</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {key.lastUsedAt ? `Last used ${formatAge(key.lastUsedAt)}` : 'Never used'}
                {key.expiresAt ? ` · Expires ${new Date(key.expiresAt).toLocaleDateString()}` : ''}
              </p>
            </div>
            <Button
              variant="ghost"
              className="self-start text-red-700 hover:bg-red-50 hover:text-red-800 sm:self-auto"
              onClick={() => remove.mutate(key.id)}
              disabled={remove.isPending}
              aria-label={`Delete ${key.name}`}
            >
              <Trash2 /> Revoke
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SetupGuidance() {
  return (
    <Card className="border-border bg-muted shadow-none">
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

function GeneralSettings() {
  return null;
}
