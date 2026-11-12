import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/$organizationSlug/trace/$traceId')({ component: () => null });
