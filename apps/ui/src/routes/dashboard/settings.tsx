import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, ShieldAlert, Wifi, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { QueryErrorState } from '~/components/query-error-state';

export const Route = createFileRoute('/dashboard/settings')({
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
    queryFn: () => api.get<TelemetryStatus>(`/dashboard/telemetry-status?projectId=${encodeURIComponent(projectId)}`),
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
