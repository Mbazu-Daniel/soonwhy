import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/$organizationSlug/api-keys')({ component: ApiKeysRedirect });

function ApiKeysRedirect() {
  const navigate = useNavigate();
  const { orgSlug, projectSlug } = useProject();

  useEffect(() => {
    if (!orgSlug || !projectSlug) return;
    void navigate({
      to: '/$organizationSlug/p/$projectSlug/api-keys',
      params: { organizationSlug: orgSlug, projectSlug },
      replace: true,
    });
  }, [navigate, orgSlug, projectSlug]);

  return null;
}
