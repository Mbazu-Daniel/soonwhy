import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { OrganizationForm } from '~/components/auth/organization-form';

interface Organization { id: string; name: string; slug: string; }

export const Route = createFileRoute('/$organizationSlug')({ component: OrganizationHome });

function OrganizationHome() {
  const { organizationSlug } = Route.useParams();
  const navigate = useNavigate();
  const { setOrganization } = useProject();
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<Organization[]>('/organizations'),
  });

  const organization = organizations.data?.find((org) => org.slug === organizationSlug);

  useEffect(() => {
    if (organization) setOrganization({ id: organization.id, slug: organization.slug });
  }, [organization, setOrganization]);

  if (organizations.isLoading) {
    return <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading organization...</main>;
  }

  if (!organization) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-background px-6 text-foreground">
        <p className="text-sm font-semibold uppercase tracking-[.14em] text-[#16931F]">Organization</p>
        <h1 className="mt-2 text-3xl font-semibold">Create {organizationSlug}</h1>
        <p className="mt-2 text-sm text-muted-foreground">This subdomain is not in your account yet. Enter the organization name to create it.</p>
        <div className="mt-8"><OrganizationForm defaultSubdomain={organizationSlug} /></div>
        <button type="button" className="mt-6 text-sm text-muted-foreground" onClick={() => void navigate({ to: '/login' })}>Use a different account</button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center bg-background px-6 text-foreground">
      <p className="text-sm font-semibold uppercase tracking-[.14em] text-[#16931F]">{organization.slug}</p>
      <h1 className="mt-2 text-4xl font-semibold">{organization.name}</h1>
      <p className="mt-3 text-muted-foreground">This workspace is ready. Continue setup or open the dashboard.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/onboarding" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Continue setup</Link>
        <Link to="/dashboard" className="rounded-lg border border-border px-4 py-2 text-sm font-medium">Open dashboard</Link>
      </div>
    </main>
  );
}
