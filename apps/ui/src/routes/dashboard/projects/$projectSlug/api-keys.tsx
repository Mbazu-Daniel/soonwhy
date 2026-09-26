import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { ApiKeySettings } from './settings';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/dashboard/projects/$projectSlug/api-keys')({
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const { projectId } = useProject();
  const queryClient = useQueryClient();

  if (!projectId) {
    return <Card><CardContent className="p-10 text-center"><KeyRound className="mx-auto h-7 w-7 text-[#16931F]" /><p className="mt-2 font-medium">Choose a project</p></CardContent></Card>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#16931F]">Project access</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create and revoke ingestion keys for this project.</p>
      </header>
      <ApiKeySettings projectId={projectId} queryClient={queryClient} />
    </div>
  );
}
