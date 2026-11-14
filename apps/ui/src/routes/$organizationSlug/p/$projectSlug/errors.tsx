import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/errors')({ component: Outlet });
