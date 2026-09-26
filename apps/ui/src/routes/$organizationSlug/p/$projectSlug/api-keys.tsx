import { createFileRoute } from '@tanstack/react-router';
import { Route as ExistingRoute } from '~/routes/dashboard/projects/$projectSlug/api-keys';

const ProjectApiKeys = ExistingRoute.options.component!;

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/api-keys')({
  component: ProjectApiKeys,
});
