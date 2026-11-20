import { eq } from "drizzle-orm";
import { db } from "../../../../common/db";
import { organizations, projects } from "../../../../common/db/schema";
import { DEFAULT_FRONTEND_URL, FINDINGS_PATH } from "./alert-context.constants";
import type { AlertContext } from "./alert-context.types";

export async function loadAlertContext(projectId: string): Promise<AlertContext> {
  const [row] = await db
    .select({ projectName: projects.name, projectSlug: projects.slug, orgSlug: organizations.slug })
    .from(projects)
    .innerJoin(organizations, eq(organizations.id, projects.organizationId))
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!row) return {};
  const base = (process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL).replace(/\/$/, "");
  return {
    projectName: row.projectName,
    findingUrl: `${base}/${row.orgSlug}/p/${row.projectSlug}${FINDINGS_PATH}`,
  };
}
