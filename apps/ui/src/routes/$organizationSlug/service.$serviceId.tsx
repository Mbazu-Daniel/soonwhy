import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/$organizationSlug/service/$serviceId')({ component: () => null });
