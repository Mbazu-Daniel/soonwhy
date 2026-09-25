import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { OrganizationForm } from '~/components/auth/organization-form';

interface Organization { id: string; name: string; slug: string; }

export const Route = createFileRoute('/organizations')({ component: Organizations });

function Organizations() {
  const navigate = useNavigate();
  const { setOrganization } = useProject();
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<Organization[]>('/organizations'),
  });

  const organization = organizations.data?.[0];

  useEffect(() => {
    if (!organization) return;
    setOrganization(organization);
    void navigate({ to: '/$organizationSlug/dashboard', params: { organizationSlug: organization.slug }, replace: true });
  }, [organization, navigate, setOrganization]);

  if (organizations.isLoading || organization) {
    return <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Opening workspace...</main>;
  }

  return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-background px-6 text-foreground">
      <h1 className="text-3xl font-semibold">Create your organization</h1>
      <p className="mt-2 text-sm text-muted-foreground">Enter the organization name and the subdomain for this workspace.</p>
      <div className="mt-8"><OrganizationForm /></div>
    </main>
  );
}
