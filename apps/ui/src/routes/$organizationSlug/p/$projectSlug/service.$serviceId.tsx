import { createFileRoute } from '@tanstack/react-router';
import { Route as ExistingRoute } from '~/routes/dashboard/projects/$projectSlug/service.$serviceId';

const ProjectServiceDetail = ExistingRoute.options.component!;

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/service/$serviceId')({
  component: ProjectServiceDetail,
});
