import { createFileRoute } from '@tanstack/react-router';
import { Route as ExistingRoute } from '~/routes/dashboard/projects/$projectSlug/trace.$traceId';

const ProjectTraceDetail = ExistingRoute.options.component!;

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/trace/$traceId')({
  component: ProjectTraceDetail,
});
