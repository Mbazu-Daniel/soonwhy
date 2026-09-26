import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck, Activity, Clock3 } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { ApiKeySettings } from './settings';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/api-keys')({
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const { projectId } = useProject();
  const queryClient = useQueryClient();

  if (!projectId) {
    return <Card className="rounded-2xl border-dashed border-[#242426] bg-[#0B0B0C]"><CardContent className="p-12 text-center"><KeyRound className="mx-auto h-6 w-6 text-[#ACFC15]" /><p className="mt-3 text-sm font-medium">Choose a project</p><p className="mt-1 text-xs text-[#989898]">Select a project from the sidebar to manage ingestion keys.</p></CardContent></Card>;
  }

  return (
    <div className="min-h-full space-y-5 pb-8">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ACFC15]">Project access</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-[#F6F6F6]">API keys</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#989898]">Create and revoke ingestion keys used by applications connected to this project.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#242426] bg-[#0B0B0C] px-3 py-2 text-xs text-[#989898]"><KeyRound className="h-3.5 w-3.5 text-[#ACFC15]" />Project credentials</div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric icon={KeyRound} label="Credential type" value="Ingestion keys" />
        <Metric icon={ShieldCheck} label="Scope" value="Project only" />
        <Metric icon={Activity} label="Usage" value="Telemetry ingestion" />
      </section>

      <ApiKeySettings projectId={projectId} queryClient={queryClient} />
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof KeyRound; label: string; value: string }) {
  return <Card className="rounded-2xl border-[#242426] bg-[#0B0B0C] shadow-none"><CardContent className="p-5"><div className="flex items-center justify-between"><span className="text-xs text-[#989898]">{label}</span><Icon className="h-4 w-4 text-[#ACFC15]" /></div><p className="mt-5 text-sm font-semibold text-[#F6F6F6]">{value}</p><p className="mt-2 text-xs text-[#6E6E70]">Configured for the active project.</p></CardContent></Card>;
}
