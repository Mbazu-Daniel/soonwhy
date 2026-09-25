import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Loader2, Server, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/onboarding')({ component: Onboarding });

interface Organization { id: string; name: string; slug: string; organization?: Organization; }
interface Project { id: string; name: string; slug: string; description?: string | null; }
interface ApiKey { id: string; name: string; prefix: string; key: string; }

const steps = ['Organization', 'Project', 'Connect', 'Verify'];

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orgId, orgSlug: workspaceSlug, projectId, setOrganization, setProjectId, clearProjectId } = useProject();
  const [step, setStep] = useState(() => {
    if (typeof window === 'undefined') return orgId ? 1 : 0;
    const saved = Number(localStorage.getItem('soonwhy:onboarding-step'));
    return saved === 0 || saved === 1 ? saved : (orgId ? 1 : 0);
  });
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [apiKey, setApiKey] = useState<ApiKey | null>(null);
  const [error, setError] = useState('');

  function goToStep(next: number) {
    setStep(next);
    if (typeof window !== 'undefined') localStorage.setItem('soonwhy:onboarding-step', String(next));
  }

  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<Organization[]>('/organizations'),
  });

  const projects = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!orgId,
  });

  const createOrg = useMutation({
    mutationFn: (input: { name: string; slug: string }) => api.post<Organization>('/organizations', input),
    onSuccess: (org) => {
      const created = 'organization' in org && org.organization ? org.organization : org;
      if (created.id && created.slug) setOrganization(created);
      clearProjectId();
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      goToStep(1);
      setError('');
    },
    onError: (err: Error) => setError(err.message),
  });

  const createProject = useMutation({
    mutationFn: (input: { name: string; slug: string }) => api.post<Project>('/projects', input),
    onSuccess: (project) => {
      setProjectId(project.id);
      localStorage.removeItem('soonwhy:onboarding-step');
      void queryClient.invalidateQueries({ queryKey: ['projects', orgId] });
      void navigate({ to: '/$organizationSlug/dashboard', params: { organizationSlug: workspaceSlug! } });
    },
    onError: (err: Error) => setError(err.message),
  });

  const createKey = useMutation({
    mutationFn: () => api.post<ApiKey>('/api-keys?projectId=' + encodeURIComponent(projectId ?? ''), { name: 'Default ingestion key' }),
    onSuccess: (key) => {
      setApiKey(key);
      goToStep(3);
      setError('');
    },
    onError: (err: Error) => setError(err.message),
  });

  const verification = useQuery({
    queryKey: ['onboarding-verification', projectId],
    queryFn: async () => {
      const data = await api.get<{ totalRequests: number; errorRate: number; latencyP95: number }>(
        '/dashboard/overview?projectId=' + encodeURIComponent(projectId ?? ''),
      );
      return data;
    },
    enabled: step === 3 && !!projectId,
    refetchInterval: step === 3 ? 5000 : false,
  });

  const canContinueConnect = !!projectId;
  const progress = ((step + 1) / steps.length) * 100;
  const verificationReady = (verification.data?.totalRequests ?? 0) > 0;

  const snippet = useMemo(() => {
    const key = apiKey?.key ?? '<YOUR_PROJECT_API_KEY>';
    return `import { initNode } from '@soonwhy/sdk/node';

const sdk = initNode({
  apiKey: process.env.SOONWHY_API_KEY ?? '${key}',
  endpoint: process.env.SOONWHY_ENDPOINT,
  serviceName: 'my-service',
  environment: 'production',
});`;
  }, [apiKey]);

  function selectOrganization(id: string) {
    const selected = organizations.data?.find((org) => org.id === id);
    if (selected) setOrganization(selected);
    clearProjectId();
    goToStep(1);
    setError('');
  }

  function submitOrganization(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const slug = orgSlug || slugify(orgName);
    if (!orgName.trim() || !slug) return setError('Enter an organization name.');
    createOrg.mutate({ name: orgName.trim(), slug });
  }

  function submitProject(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const slug = projectSlug || slugify(projectName);
    if (!projectName.trim() || !slug) return setError('Enter a project name.');
    createProject.mutate({ name: projectName.trim(), slug });
  }

  function continueFromProject() {
    if (!projectId) return setError('Select or create a project first.');
    setError('');
    goToStep(2);
  }

  function finish() {
    if (projectId) setProjectId(projectId);
    localStorage.removeItem('soonwhy:onboarding-step');
    navigate({ to: '/dashboard' });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          {workspaceSlug
            ? <Link to="/$organizationSlug" params={{ organizationSlug: workspaceSlug }} className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Workspace</Link>
            : <span className="text-sm font-semibold">Workspace</span>}
          <span className="text-sm font-semibold">SoonWhy setup</span>
          <span className="text-xs text-muted-foreground">{step + 1} of {steps.length}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            {steps.map((label, index) => <span key={label} className={index <= step ? 'text-[#16931F]' : ''}>{label}</span>)}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-[#8BD125] transition-all" style={{ width: progress + '%' }} /></div>
        </div>

        {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        {step === 0 && (
          <StepCard icon={ShieldCheck} title="Create your organization" description="Your organization is the tenant boundary for projects, members and telemetry.">
            {organizations.data && organizations.data.length > 0 && (
              <div className="mb-6 space-y-2">
                <p className="text-sm font-medium">Use an existing organization</p>
                {organizations.data.map((org) => (
                  <button key={org.id} type="button" onClick={() => selectOrganization(org.id)} className="flex w-full items-center justify-between rounded-lg border border-border bg-card p-3 text-left hover:border-[#8BD125]">
                    <span><span className="block text-sm font-medium">{org.name}</span><span className="text-xs text-muted-foreground">{org.slug}</span></span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                <div className="py-2 text-center text-xs text-muted-foreground">or create a new one</div>
              </div>
            )}
            <form onSubmit={submitOrganization} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="org-name">Organization name</Label><Input id="org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme" required maxLength={100} /></div>
              <div className="space-y-2"><Label htmlFor="org-slug">Subdomain</Label><Input id="org-slug" value={orgSlug} onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="acme" pattern="[a-z0-9-]+" /></div>
              <Button type="submit" className="w-full" disabled={createOrg.isPending}>{createOrg.isPending ? 'Creating...' : <>Create organization <ArrowRight /></>}</Button>
            </form>
          </StepCard>
        )}

        {step === 1 && (
          <StepCard icon={Server} title="Create your first project" description="A project is the boundary for your application's telemetry and ingestion API key.">
            {projects.data && projects.data.length > 0 && (
              <div className="mb-6 space-y-2">
                <p className="text-sm font-medium">Use an existing project</p>
                {projects.data.map((project) => (
                  <button key={project.id} type="button" onClick={() => { setProjectId(project.id); localStorage.removeItem('soonwhy:onboarding-step'); void navigate({ to: '/$organizationSlug/dashboard', params: { organizationSlug: workspaceSlug! } }); }} className="flex w-full items-center justify-between rounded-lg border border-border bg-card p-3 text-left hover:border-[#8BD125]">
                    <span><span className="block text-sm font-medium">{project.name}</span><span className="text-xs text-muted-foreground">{project.slug}</span></span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                <div className="py-2 text-center text-xs text-muted-foreground">or create another project</div>
              </div>
            )}
            <form onSubmit={submitProject} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="project-name">Project name</Label><Input id="project-name" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Payments API" required maxLength={100} /></div>
              <div className="space-y-2"><Label htmlFor="project-slug">Slug</Label><Input id="project-slug" value={projectSlug} onChange={(e) => setProjectSlug(e.target.value)} placeholder="payments-api" pattern="[a-z0-9-]+" /></div>
              <Button type="submit" className="w-full" disabled={createProject.isPending}>{createProject.isPending ? 'Creating...' : <>Create project <ArrowRight /></>}</Button>
            </form>
          </StepCard>
        )}

        {step === 2 && (
          <StepCard icon={Sparkles} title="Connect OpenTelemetry" description="Create a project API key and send your first spans through the SoonWhy SDK.">
            <div className="rounded-xl border border-border bg-muted p-4 text-sm">
              <p className="font-medium">Project selected</p>
              <p className="mt-1 text-muted-foreground">{projects.data?.find((project) => project.id === projectId)?.name ?? 'Your project'}</p>
            </div>
            {apiKey ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Copy this key now.</strong> The raw API key is shown only when it is created.</div>
                <div className="rounded-xl border bg-[#182012] p-4 text-xs text-white"><code className="break-all">{apiKey.key}</code></div>
                <pre className="overflow-x-auto rounded-xl bg-[#182012] p-4 text-xs leading-6 text-white"><code>{snippet}</code></pre>
                <Button type="button" variant="outline" onClick={() => void navigator.clipboard?.writeText(snippet)}><Copy /> Copy setup snippet</Button>
                <Button type="button" onClick={() => goToStep(3)}>I've connected it <ArrowRight /></Button>
              </div>
            ) : (
              <Button type="button" className="mt-5 w-full" disabled={!canContinueConnect || createKey.isPending} onClick={() => createKey.mutate()}>
                {createKey.isPending ? 'Creating API key...' : <>Create ingestion key <ArrowRight /></>}
              </Button>
            )}
          </StepCard>
        )}

        {step === 3 && (
          <StepCard icon={Check} title={verificationReady ? 'Telemetry received' : 'Waiting for telemetry'} description={verificationReady ? 'SoonWhy has received project telemetry. You can open the dashboard now.' : 'Run the setup snippet in your application. This page checks for telemetry every few seconds.'}>
            <div className="rounded-xl border border-border bg-card p-5">
              {verification.isFetching && !verificationReady && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking for telemetry...</div>}
              {verificationReady ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Stat label="Requests" value={verification.data?.totalRequests.toLocaleString() ?? '0'} />
                  <Stat label="Error rate" value={verification.data ? verification.data.errorRate + '%' : '—'} />
                  <Stat label="P95 latency" value={verification.data ? verification.data.latencyP95 + 'ms' : '—'} />
                </div>
              ) : verification.isError ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">We could not check ingestion right now.</p>
                  <p className="text-sm text-muted-foreground">Your project and key are still ready. Retry the check or continue to the dashboard.</p>
                  <Button type="button" variant="outline" onClick={() => void verification.refetch()}>Retry check</Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No requests have been observed yet. Your API key and project are ready, so you can keep this page open while sending your first request.</p>
              )}
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => goToStep(2)}><ArrowLeft /> Back to setup</Button>
              <Button type="button" onClick={finish}>{verificationReady ? 'Open dashboard' : 'Go to dashboard'} <ExternalLink /></Button>
            </div>
          </StepCard>
        )}
      </main>
    </div>
  );
}

function StepCard({ icon: Icon, title, description, children }: { icon: typeof Server; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="mx-auto max-w-2xl border-border bg-card shadow-sm">
      <CardHeader className="p-6 pb-4 sm:p-8 sm:pb-5"><div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[#C9E7EB]"><Icon className="h-5 w-5" /></div><CardTitle className="text-2xl">{title}</CardTitle><p className="text-sm leading-6 text-muted-foreground">{description}</p></CardHeader>
      <CardContent className="p-6 pt-1 sm:p-8 sm:pt-2">{children}</CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}
