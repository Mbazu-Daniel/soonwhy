import { createFileRoute } from '@tanstack/react-router';
import { Route as ExistingRoute } from '~/routes/dashboard/projects/$projectSlug/services';

const ProjectServices = ExistingRoute.options.component!;

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/services')({
  component: ProjectServices,
});
