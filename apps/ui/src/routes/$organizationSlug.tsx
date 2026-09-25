import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { OrganizationForm } from '~/components/auth/organization-form';

interface Organization { id: string; name: string; slug: string; }

export const Route = createFileRoute('/$organizationSlug')({ component: OrganizationEntry });

function OrganizationEntry() {
  const { organizationSlug } = Route.useParams();
  const navigate = useNavigate();
  const { setOrganization } = useProject();
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<Organization[]>('/organizations'),
  });
  const organization = organizations.data?.find((org) => org.slug === organizationSlug);

  useEffect(() => {
    if (organization) {
      setOrganization(organization);
      void navigate({ to: '/$organizationSlug/dashboard', params: { organizationSlug }, replace: true });
    }
  }, [organization, organizationSlug, navigate, setOrganization]);

  if (organizations.isLoading) {
    return <main className="grid min-h-screen place-items-center bg-[#F7FAF4] text-sm text-[#687462]">Opening dashboard...</main>;
  }

  if (!organization) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-[#F7FAF4] px-6 text-[#182012]">
        <p className="text-xs font-semibold uppercase tracking-[.15em] text-[#16931F]">Organization</p>
        <h1 className="mt-2 text-3xl font-semibold">Organization not found</h1>
        <p className="mt-2 text-sm leading-6 text-[#687462]">This organization is not available in your account.</p>
        <button type="button" className="mt-6 text-left text-sm font-medium text-[#16931F] hover:underline" onClick={() => void navigate({ to: '/organizations' })}>Choose another organization</button>
      </main>
    );
  }

  return null;
}
