import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/intelligence/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/$organizationSlug/p/$projectSlug/intelligence/findings',
      params,
    });
  },
});
