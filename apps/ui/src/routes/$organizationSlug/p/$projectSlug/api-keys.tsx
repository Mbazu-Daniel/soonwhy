import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { ApiKeySettings } from './settings';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/api-keys')({ component: ApiKeysPage });

function ApiKeysPage() {
  const { projectId } = useProject();
  const queryClient = useQueryClient();

  if (!projectId) {
    return <Card className="rounded-2xl border-dashed border-[#242426] bg-[#0B0B0C]"><CardContent className="p-12 text-center"><KeyRound className="mx-auto h-6 w-6 text-[#ACFC15]" /><p className="mt-3 text-sm font-medium">Choose a project</p></CardContent></Card>;
  }

  return (
    <div className="min-h-full space-y-5 pb-8">
      <header>
        <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-[#F6F6F6]">API keys</h1>
        <p className="mt-1 text-sm text-[#989898]">Create and revoke ingestion keys.</p>
      </header>
      <ApiKeySettings projectId={projectId} queryClient={queryClient} />
    </div>
  );
}
