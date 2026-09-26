import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { organizationSlug } from '~/components/auth/organization-form';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
}

interface CreatedOrganization {
  id?: string;
  name?: string;
  slug?: string;
  organization?: { id: string; name: string; slug: string };
}

export function OrganizationMark({ name, logo }: { name: string; logo?: string | null }) {
  if (logo) {
    return <img src={logo} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover" />;
  }

  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#151517] text-xs font-bold text-[#ACFC15]">
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

export function WorkspaceMenu({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setOrganization, clearProjectId } = useProject();
  const { organizations, current, orgSlug } = useWorkspaces();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const workspaceName = current?.name ?? orgSlug ?? 'Workspace';

  function switchWorkspace(workspace: Workspace) {
    if (workspace.slug === orgSlug) return;
    clearProjectId();
    setOrganization({ id: workspace.id, slug: workspace.slug });
    void navigate({ to: '/$organizationSlug/dashboard', params: { organizationSlug: workspace.slug } });
  }

  async function createOrganization(event: FormEvent) {
    event.preventDefault();
    const slug = organizationSlug(subdomain || name);
    if (!name.trim() || !slug) {
      setError('Enter an organization name and subdomain.');
      return;
    }

    setError('');
    setPending(true);
    try {
      const created = await api.post<CreatedOrganization>('/organizations', { name: name.trim(), slug });
      const organization = created.organization ?? created;
      if (!organization.id || !organization.slug) throw new Error('Organization was created without a subdomain');
      clearProjectId();
      setOrganization({ id: organization.id, slug: organization.slug });
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setCreating(false);
      setName('');
      setSubdomain('');
      void navigate({ to: '/$organizationSlug/dashboard', params: { organizationSlug: organization.slug } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the organization');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={compact ? 'flex' : 'flex min-w-0 flex-1'}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Switch workspace" className={`flex h-9 min-w-0 items-center gap-2 rounded-lg border border-[#242426] bg-[#151517] text-sm text-[#F6F6F6] outline-none hover:border-[#3A3A3C] focus-visible:border-[#ACFC15] ${compact ? 'w-9 justify-center px-0' : 'w-full px-2'}`}>
            <OrganizationMark name={workspaceName} logo={current?.logo} />
            {!compact && <span className="min-w-0 flex-1 truncate text-left">{workspaceName}</span>}
            {!compact && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#989898]" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 border-[#242426] bg-[#0B0B0C] text-[#F6F6F6]">
          {(organizations.data ?? []).map((workspace) => (
            <DropdownMenuItem key={workspace.id} onSelect={() => switchWorkspace(workspace)} className="focus:bg-[#151517] focus:text-[#F6F6F6]">
              <OrganizationMark name={workspace.name} logo={workspace.logo} />
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {workspace.slug === orgSlug && <Check className="h-4 w-4 text-[#ACFC15]" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="bg-[#242426]" />
          <DropdownMenuItem onSelect={() => setCreating(true)} className="focus:bg-[#151517] focus:text-[#F6F6F6]">
            <Plus className="h-4 w-4 text-[#ACFC15]" />
            Create organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="border-[#242426] bg-[#0B0B0C] text-[#F6F6F6]">
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
            <DialogDescription className="text-[#989898]">This becomes a workspace you can switch to from the menu.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createOrganization} className="space-y-4">
            {error && <div role="alert" className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="new-organization-name">Organization</Label>
              <Input id="new-organization-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Acme" required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-organization-subdomain">Subdomain</Label>
              <Input id="new-organization-subdomain" value={subdomain} onChange={(event) => setSubdomain(organizationSlug(event.target.value))} placeholder="acme" pattern="[a-z0-9-]+" required />
            </div>
            <Button type="submit" className="h-10 w-full bg-[#8BD125] text-[#182012] hover:bg-[#9be33c]" disabled={pending}>
              {pending ? 'Creating...' : 'Create organization'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
