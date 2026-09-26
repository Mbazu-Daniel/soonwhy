import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
}

export function OrganizationMark({ name, logo }: { name: string; logo?: string | null }) {
  if (logo) {
    return <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />;
  }

  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#0B0B0C] text-sm font-bold text-[#ACFC15]">
      {name.charAt(0).toUpperCase() || 'W'}
    </span>
  );
}

export function useWorkspaces() {
  const { orgSlug } = useProject();
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<Workspace[]>('/organizations'),
    enabled: !!orgSlug,
  });
  const current = organizations.data?.find((workspace) => workspace.slug === orgSlug) ?? null;
  return { organizations, current, orgSlug };
}

export function WorkspaceSelect({ id }: { id: string }) {
  const navigate = useNavigate();
  const { setOrganization, clearProjectId } = useProject();
  const { organizations, current, orgSlug } = useWorkspaces();

  function switchWorkspace(slug: string) {
    const next = organizations.data?.find((workspace) => workspace.slug === slug);
    if (!next || next.slug === orgSlug) return;
    clearProjectId();
    setOrganization({ id: next.id, slug: next.slug });
    void navigate({ to: '/$organizationSlug/dashboard', params: { organizationSlug: next.slug } });
  }

  const options = organizations.data?.length
    ? organizations.data
    : current
      ? [current]
      : orgSlug
        ? [{ id: orgSlug, name: orgSlug, slug: orgSlug }]
        : [];

  return (
    <select
      id={id}
      aria-label="Switch workspace"
      value={orgSlug ?? ''}
      onChange={(event) => switchWorkspace(event.target.value)}
      className="h-9 w-40 min-w-0 max-w-full truncate rounded-lg border border-[#242426] bg-[#151517] px-2 text-sm text-[#F6F6F6] outline-none focus:border-[#ACFC15] sm:w-52"
    >
      {options.map((workspace) => (
        <option key={workspace.id} value={workspace.slug}>{workspace.name}</option>
      ))}
    </select>
  );
}
