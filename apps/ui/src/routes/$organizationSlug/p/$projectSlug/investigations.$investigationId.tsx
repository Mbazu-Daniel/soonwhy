import { createFileRoute } from '@tanstack/react-router';
import { Route as ExistingRoute } from '~/routes/dashboard/projects/$projectSlug/investigations.$investigationId';

const ProjectInvestigationDetail = ExistingRoute.options.component!;

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/investigations/$investigationId')({
  component: ProjectInvestigationDetail,
});
