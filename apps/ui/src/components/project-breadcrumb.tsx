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
  const suffix = projectIndex >= 0 ? location.pathname.slice(projectIndex + marker.length).replace(/^\\//, '') : '';
  const label = labels[suffix] ?? 'Monitor';

  function selectProject(project: Project) {
    const target = suffix ? `/${orgSlug}/p/${project.slug}/${suffix}` : `/${orgSlug}/p/${project.slug}/`;
    void navigate({ to: target as never });
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="inline-flex max-w-56 items-center gap-1 rounded-md px-1.5 py-1 font-medium text-[#F6F6F6] hover:bg-[#151517]">
            <span className="truncate">{projects.data?.find((item) => item.slug === projectSlug)?.name ?? projectSlug}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#989898]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60 border-[#242426] bg-[#0B0B0C] text-[#F6F6F6]">
          {projects.data?.map((project) => (
            <DropdownMenuItem key={project.id} onSelect={() => selectProject(project)} className="focus:bg-[#151517] focus:text-[#F6F6F6]">
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              {project.slug === projectSlug && <Check className="h-4 w-4 text-[#ACFC15]" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-[#555557]">/</span>
      <span className="truncate text-[#989898]">{label}</span>
    </nav>
  );
}
