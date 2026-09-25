import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getSession, setSessionToken } from '~/lib/auth-client';
import { firstOrganization } from '~/lib/open-organization';
import { useProject } from '~/lib/project-context';
import { OrganizationForm } from '~/components/auth/organization-form';

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const { setOrganization } = useProject();
  const [error, setError] = useState('');
  const [needsOrganization, setNeedsOrganization] = useState(false);

  useEffect(() => {
    let active = true;

    void getSession().then(async (result) => {
      if (!active) return;

      if (result.error || !result.data?.session.token) {
        setError(result.error?.message || 'Unable to establish your session.');
        return;
      }

      setSessionToken(result.data.session.token);
      const organization = await firstOrganization().catch(() => null);
      if (!organization) {
        setNeedsOrganization(true);
        return;
      }
      setOrganization(organization);
      navigate({ to: '/$organizationSlug', params: { organizationSlug: organization.slug } });
    });

    return () => {
      active = false;
    };
  }, [navigate, setOrganization]);

  if (needsOrganization) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="text-3xl font-semibold">Create your organization</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter the organization name and the subdomain for this workspace.</p>
        <div className="mt-8"><OrganizationForm /></div>
      </main>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-foreground">Authentication failed</h1>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">{error}</p>
            <a href="/login" className="mt-5 inline-block text-sm font-medium text-[#16931F] hover:underline">
              Return to sign in
            </a>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#D8E2D3] border-t-[#8BD125]" />
            <p className="mt-4 text-sm text-muted-foreground">Finishing authentication...</p>
          </>
        )}
      </div>
    </div>
  );
}
