import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/dashboard/projects/$projectSlug')({
  component: LegacyProjectRoute,
});

function LegacyProjectRoute() {
  const { projectSlug } = Route.useParams();
  const navigate = useNavigate();
  const { orgSlug } = useProject();

  useEffect(() => {
    if (orgSlug) {
      void navigate({
        to: '/$organizationSlug/p/$projectSlug/',
        params: { organizationSlug: orgSlug, projectSlug },
        replace: true,
      });
    }
  }, [navigate, orgSlug, projectSlug]);

  return <Outlet />;
}
