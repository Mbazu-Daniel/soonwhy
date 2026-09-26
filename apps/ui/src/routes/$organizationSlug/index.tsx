import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

export const Route = createFileRoute('/$organizationSlug/')({ component: OrganizationIndex });

function OrganizationIndex() {
  const { organizationSlug } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: '/$organizationSlug/dashboard', params: { organizationSlug }, replace: true });
  }, [navigate, organizationSlug]);

  return <div className="min-h-full bg-[#F7FAF4]" />;
}
