import { createFileRoute } from '@tanstack/react-router';
import { Route as ExistingRoute } from '~/routes/dashboard/projects/$projectSlug/index';

const ProjectOverview = ExistingRoute.options.component!;

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/')({
  component: ProjectOverview,
});
