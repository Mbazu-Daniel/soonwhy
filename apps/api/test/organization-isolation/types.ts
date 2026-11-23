import type { createOrganization, createProject } from "../support/fixtures";

export type OrganizationRow = NonNullable<Awaited<ReturnType<typeof createOrganization>>>;
export type ProjectRow = NonNullable<Awaited<ReturnType<typeof createProject>>>;
export type TestOrganization = { organization: OrganizationRow; project: ProjectRow; userId: string };
