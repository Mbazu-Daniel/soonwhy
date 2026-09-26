import { useLocation, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';

interface Project { id: string; name: string; slug: string; }

const labels: Record<string, string> = {
  '': 'Overview',
  services: 'Services',
  detections: 'Detections',
  investigations: 'Investigations',
  errors: 'Errors',
  logs: 'Logs',
  traces: 'Traces',
  'api-keys': 'API Keys',
  settings: 'Settings',
};

export function ProjectBreadcrumb() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orgId, orgSlug, projectSlug } = useProject();
  const projects = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!orgId,
  });

  if (!orgSlug || !projectSlug) return null;

  const marker = `/p/${projectSlug}`;
  const projectIndex = location.pathname.indexOf(marker);
  const suffix = projectIndex >= 0 ? location.pathname.slice(projectIndex + marker.length).replace(/^\//, '') : '';
  const label = labels[suffix] ?? 'Monitor';

  function selectProject(project: Project) {
    const target = suffix ? `/${orgSlug}/p/${project.slug}/${suffix}` : `/${orgSlug}/p/${project.slug}/`;
    void navigate({ to: target as never });
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex min-w-0 items-center gap-1.5 text-sm">
      <span className="truncate text-muted-foreground">{orgSlug}</span>
      <span className="text-muted-foreground/50">/</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="inline-flex max-w-56 items-center gap-1 rounded-md px-1.5 py-1 font-medium hover:bg-secondary">
            <span className="truncate">{projects.data?.find((item) => item.slug === projectSlug)?.name ?? projectSlug}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          {projects.data?.map((project) => (
            <DropdownMenuItem key={project.id} onSelect={() => selectProject(project)}>
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              {project.slug === projectSlug && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-muted-foreground/50">/</span>
      <span className="truncate font-medium text-foreground">{label}</span>
    </nav>
  );
}
