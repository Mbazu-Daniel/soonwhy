import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';

interface CreatedOrganization {
  id?: string;
  name?: string;
  slug?: string;
  organization?: { id: string; name: string; slug: string };
}

export function organizationSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

export function OrganizationForm({ defaultSubdomain = '' }: { defaultSubdomain?: string }) {
  const navigate = useNavigate();
  const { setOrganization } = useProject();
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState(defaultSubdomain);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
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
      const org = created.organization ?? created;
      if (!org.id || !org.slug) throw new Error('Organization was created without a subdomain');
      setOrganization({ id: org.id, slug: org.slug });
      void navigate({ to: '/$organizationSlug', params: { organizationSlug: org.slug } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the organization');
    } finally {
      setPending(false);
    }
  }

  const preview = organizationSlug(subdomain || name) || 'your-team';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div role="alert" className="auth-error">{error}</div>}
      <div className="space-y-2">
        <Label htmlFor="organization-name">Organization</Label>
        <Input id="organization-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Acme" required maxLength={100} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="organization-subdomain">Subdomain</Label>
        <Input id="organization-subdomain" value={subdomain} onChange={(event) => setSubdomain(organizationSlug(event.target.value))} placeholder="acme" pattern="[a-z0-9-]+" required />
        <p className="text-xs text-muted-foreground">localhost:3000/{preview}</p>
      </div>
      <Button type="submit" className="h-11 w-full bg-[#8BD125] text-[#182012] hover:bg-[#9be33c]" disabled={pending}>
        {pending ? 'Creating organization...' : <>Continue <ArrowRight /></>}
      </Button>
    </form>
  );
}
