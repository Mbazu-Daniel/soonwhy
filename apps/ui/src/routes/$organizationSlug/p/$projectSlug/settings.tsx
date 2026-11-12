import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/settings')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/$organizationSlug/settings',
      params: { organizationSlug: params.organizationSlug },
    });
  },
  component: () => null,
});
