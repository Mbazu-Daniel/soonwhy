import { useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, KeyRound, Loader2, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { SetupCodeBlock, SetupCopyButton, SetupFlow, SetupStep } from '~/components/setup-flow';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import type { ApiKey } from '~/lib/types';

interface TelemetryStatus {
  status: 'healthy' | 'stale' | 'waiting';
  hasTelemetry: boolean;
  lastTelemetryAt: string | null;
}

const STEPS = [
  { id: '01', title: 'Ingest token' },
  { id: '02', title: 'Install SDK' },
  { id: '03', title: 'Configure' },
] as const;

const FRAMEWORKS = [
  {
    id: 'node',
    label: 'Node.js',
    fileName: 'instrumentation.ts',
    install: 'pnpm add @soonwhy/node',
    code: (key?: string) => `import { initNode } from '@soonwhy/node';

const sdk = initNode({
  apiKey: process.env.SOONWHY_API_KEY ?? '${key ?? 'YOUR_PROJECT_API_KEY'}',
  endpoint: process.env.SOONWHY_ENDPOINT,
  serviceName: 'my-service',
  environment: 'production',
});`,
    note: 'Start instrumentation before importing your application. The first telemetry appears once real traffic flows.',
  },
  {
    id: 'bun',
    label: 'Bun',
    fileName: 'instrumentation.ts',
    install: 'bun add @soonwhy/node',
    code: (key?: string) => `import { initNode } from '@soonwhy/node';

const sdk = initNode({
  apiKey: process.env.SOONWHY_API_KEY ?? '${key ?? 'YOUR_PROJECT_API_KEY'}',
  endpoint: process.env.SOONWHY_ENDPOINT,
  serviceName: 'my-service',
  environment: 'production',
});`,
    note: 'Start instrumentation before importing your application. The first telemetry appears once real traffic flows.',
  },
  {
    id: 'nestjs',
    label: 'NestJS',
    fileName: 'app.module.ts',
    install: 'pnpm add @soonwhy/nest',
    code: (key?: string) => `import { Module } from '@nestjs/common';
import { SoonwhyModule } from '@soonwhy/nest';
import { AppController } from './app.controller';

@Module({
  imports: [
    SoonwhyModule.forRoot({
      apiKey: process.env.SOONWHY_API_KEY ?? '${key ?? 'YOUR_PROJECT_API_KEY'}',
      endpoint: process.env.SOONWHY_ENDPOINT,
      serviceName: 'my-service',
      environment: 'production',
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}`,
    note: "The SDK flushes telemetry on SIGINT/SIGTERM by default. To let Nest own shutdown instead, set registerShutdownHandlers: false and call app.enableShutdownHooks() in main.ts.",
  },
  {
    id: 'nextjs',
    label: 'Next.js',
    fileName: 'instrumentation.ts',
    install: 'pnpm add @soonwhy/next',
    code: (key?: string) => `import { createSoonwhyInstrumentation } from '@soonwhy/next';

export const { register, onRequestError } = createSoonwhyInstrumentation({
  apiKey: process.env.SOONWHY_API_KEY ?? '${key ?? 'YOUR_PROJECT_API_KEY'}',
  endpoint: process.env.SOONWHY_ENDPOINT,
  serviceName: 'my-service',
  environment: 'production',
});`,
    note: "Wrap App Router route handlers with withSoonwhy() from @soonwhy/next for route-aware span names; onRequestError reports server errors automatically.",
  },
  {
    id: 'vite',
    label: 'Vite',
    fileName: 'vite.config.ts',
    install: 'pnpm add @soonwhy/vite',
    code: (key?: string) => `import { defineConfig } from 'vite';
import soonwhy from '@soonwhy/vite';

export default defineConfig({
  plugins: [
    soonwhy({
      apiKey: process.env.SOONWHY_API_KEY ?? '${key ?? 'YOUR_PROJECT_API_KEY'}',
      endpoint: process.env.SOONWHY_ENDPOINT,
      serviceName: 'my-service',
      environment: 'production',
    }),
  ],
});`,
    note: 'Applies to the dev server only. Production servers initialize the SDK in their own server entry instead.',
  },
] as const;

type FrameworkId = (typeof FRAMEWORKS)[number]['id'];

export function ConnectServiceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { orgSlug, projectSlug, projectId } = useProject();
  const queryClient = useQueryClient();
  const [framework, setFramework] = useState<FrameworkId>('node');
  const [createdKey, setCreatedKey] = useState<ApiKey | null>(null);
  const [checking, setChecking] = useState(false);
  const selected = FRAMEWORKS.find((option) => option.id === framework) ?? FRAMEWORKS[0];

  const createKey = useMutation({
    mutationFn: () => api.post<ApiKey>(`/projects/${projectId}/api-keys`, { name: 'default' }),
    onSuccess: (key) => {
      setCreatedKey(key);
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const telemetry = useQuery({
    queryKey: ['telemetry-status', projectId],
    queryFn: () => api.get<TelemetryStatus>(`/projects/${projectId}/dashboard/telemetry-status`),
    enabled: open && !!projectId,
    refetchInterval: open && !!projectId ? 5000 : false,
  });

  async function checkConnection() {
    if (checking) return;
    setChecking(true);
    try {
      await telemetry.refetch();
    } finally {
      setChecking(false);
    }
  }

  const configureSnippet = useMemo(() => selected.code(createdKey?.key), [selected, createdKey?.key]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 animate-[sheet-overlay-in_180ms_ease-out]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-[560px] animate-[sheet-panel-in_220ms_ease-out] flex-col overflow-hidden border-l border-[#242426] bg-[#0B0B0C] text-[#F6F6F6] shadow-[-20px_0_70px_rgba(0,0,0,0.35)] outline-none"
        >
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#242426] px-5 py-4 sm:px-6">
            <DialogPrimitive.Title className="text-lg font-semibold tracking-tight">Connect a service</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close panel"
              className="-mr-2 -mt-1 grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg text-[#989898] transition-colors hover:bg-[#151517] hover:text-[#F6F6F6] focus-visible:outline-2 focus-visible:outline-[#ACFC15]"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </DialogPrimitive.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <SetupFlow steps={STEPS} onRecheck={() => void checkConnection()} isRechecking={checking} buttonSize="sm">
              <SetupStep number="01" title="Create an ingest token">
                {createdKey ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-200">
                      <strong>Copy this key now.</strong> The raw API key is only shown once.
                    </div>
                    <div className="flex items-center justify-between gap-3 break-all rounded-xl border border-[#242426] bg-[#151517] p-4 font-mono text-xs leading-6 text-[#F6F6F6]">
                      <span>{createdKey.key}</span>
                      <SetupCopyButton value={createdKey.key ?? ''} label="Copy ingest token" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCreatedKey(null)}>Create another token</Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!projectId || createKey.isPending}
                    onClick={() => createKey.mutate()}
                  >
                    {createKey.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <KeyRound aria-hidden="true" />}
                    {createKey.isPending ? 'Creating token…' : 'Create ingest token'}
                  </Button>
                )}
                {createKey.isError && (
                  <p role="alert" className="mt-3 text-xs text-red-400">Could not create the token. Check your plan limits and try again.</p>
                )}
                {!projectId && (
                  <p className="mt-3 text-xs leading-5 text-[#ACFC15]">Select or create a project before creating a token.</p>
                )}
                {orgSlug && projectSlug && (
                  <p className="mt-3">
                    <Link to="/$organizationSlug/p/$projectSlug/api-keys" params={{ organizationSlug: orgSlug, projectSlug }} onClick={onClose} className="text-[11px] leading-5 text-[#6E6E70] transition-colors hover:text-[#F6F6F6] hover:underline">Manage tokens in the API keys page</Link>
                  </p>
                )}
              </SetupStep>

              <SetupStep number="02" title="Install the SDK">
                <p className="mb-1.5 text-xs font-medium text-[#989898]">Framework</p>
                <div className="mb-4">
                  <Select value={framework} onValueChange={(value) => setFramework(value as FrameworkId)}>
                    <SelectTrigger aria-label="Framework" className="h-9 w-full border-[#242426] bg-[#151517]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FRAMEWORKS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <SetupCodeBlock>{selected.install}</SetupCodeBlock>
              </SetupStep>

              <SetupStep number="03" title={`Configure ${selected.label}`}>
                <SetupCodeBlock multiline fileName={selected.fileName}>{configureSnippet}</SetupCodeBlock>
                <p className="mt-3 text-[11px] leading-5 text-[#6E6E70]">{selected.note}</p>
                <div aria-live="polite" className="mt-4 flex items-center gap-2 text-xs">
                  {telemetry.data?.hasTelemetry ? (
                    <>
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-[#ACFC15]" />
                      <span className="font-medium text-[#ACFC15]">Connected — telemetry received</span>
                    </>
                  ) : (
                    <>
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-[#989898]" />
                      <span className="text-[#989898]">Waiting for your first request…</span>
                    </>
                  )}
                </div>
              </SetupStep>
            </SetupFlow>
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#242426] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 sm:px-6">
            <a
              href="https://github.com/Mbazu-Daniel/soonwhy#readme"
              target="_blank"
              rel="noreferrer"
              className="mr-auto inline-flex min-h-8 items-center gap-1.5 rounded-md text-[12px] text-[#989898] transition-colors hover:text-[#F6F6F6] focus-visible:outline-2 focus-visible:outline-[#ACFC15]"
            >
              Read the docs
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
            <Button variant="secondary" size="sm" onClick={onClose}>Done</Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
