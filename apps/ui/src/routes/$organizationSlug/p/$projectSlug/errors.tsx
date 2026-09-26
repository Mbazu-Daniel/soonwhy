import { createFileRoute } from '@tanstack/react-router';
import { Route as ExistingRoute } from '~/routes/dashboard/projects/$projectSlug/errors';

const ProjectErrors = ExistingRoute.options.component!;

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/errors')({
  component: ProjectErrors,
});
