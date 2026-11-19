import { NotFoundException } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../../../../common/db";
import { organizations, projects, projectSettings } from "../../../../../common/db/schema";

export async function resolveStatusTarget(
  orgSlug: string,
  projectSlug: string,
): Promise<{ orgId: string; projectId: string }> {
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.slug, orgSlug), isNull(organizations.deletedAt)))
    .limit(1);
  if (!org) throw new NotFoundException("Organization not found");

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.slug, projectSlug), eq(projects.organizationId, org.id)))
    .limit(1);
  if (!project) throw new NotFoundException("Project not found");

  const [settings] = await db
    .select({ statusPagePublic: projectSettings.statusPagePublic })
    .from(projectSettings)
    .where(eq(projectSettings.projectId, project.id))
    .limit(1);
  if (!settings?.statusPagePublic) throw new NotFoundException("Project not found");

  return { orgId: org.id, projectId: project.id };
}
