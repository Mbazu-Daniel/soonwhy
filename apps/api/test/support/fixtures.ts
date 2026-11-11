import { randomUUID } from "node:crypto";
import { db } from "../../src/common/db";
import { organizations, projects } from "../../src/common/db/schema";

export async function createOrganization() {
  const slug = `org-${randomUUID()}`;
  const [organization] = await db
    .insert(organizations)
    .values({ name: slug, slug })
    .returning();

  return organization;
}

export async function createProject(organizationId: string, slug = `project-${randomUUID()}`) {
  const [project] = await db
    .insert(projects)
    .values({ organizationId, name: slug, slug })
    .returning();

  return project;
}
