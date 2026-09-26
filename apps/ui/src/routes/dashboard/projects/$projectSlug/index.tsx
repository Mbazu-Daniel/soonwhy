import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/dashboard/projects/$projectSlug/')({ component: ProjectOverview });
function ProjectOverview() {
  return <div className="space-y-4"><h1 className="text-2xl font-semibold">Project overview</h1><p className="text-sm text-muted-foreground">Select a project area from the sidebar.</p></div>;
}
