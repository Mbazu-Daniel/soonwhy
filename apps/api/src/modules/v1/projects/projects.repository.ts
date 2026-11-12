import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { db } from "../../../common/db";
import { projectSettings, projects } from "../../../common/db/schema";

@Injectable()
export class ProjectsRepository {
  async getProjectById(id: string, orgId: string) {
    return db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.organizationId, orgId)),
    });
  }

  async getProjectsByOrgId(orgId: string) {
    return db.query.projects.findMany({
      where: eq(projects.organizationId, orgId),
    });
  }

  async getProjectByOrgAndSlug(orgId: string, slug: string) {
    return db.query.projects.findFirst({
      where: and(eq(projects.organizationId, orgId), eq(projects.slug, slug)),
    });
  }

  async createProject(data: {
    organizationId: string;
    name: string;
    slug: string;
    description?: string;
  }) {
    const [project] = await db.insert(projects).values(data).returning();
    return project;
  }

  async updateProject(
    id: string,
    orgId: string,
    data: { name?: string; description?: string },
  ) {
    const [updated] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.organizationId, orgId)))
      .returning();
    return updated;
  }

  async deleteProject(id: string, orgId: string) {
    await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, orgId)));
  }

  async getProjectSettings(id: string, orgId: string) {
    const rows = await db
      .select({
        projectId: projectSettings.projectId,
        maxAttributeCount: projectSettings.maxAttributeCount,
        maxAttributeValueLength: projectSettings.maxAttributeValueLength,
      })
      .from(projectSettings)
      .innerJoin(projects, eq(projectSettings.projectId, projects.id))
      .where(and(eq(projectSettings.projectId, id), eq(projects.organizationId, orgId)));
    if (!rows[0]) return this.defaultProjectSettings(id);
    return {
      ...rows[0],
      redactSensitiveData: true,
      captureRequestHeaders: true,
      captureRequestBody: true,
      captureResponseBody: true,
    };
  }

  async updateProjectSettings(
    id: string,
    orgId: string,
    data: {
      maxAttributeCount?: number;
      maxAttributeValueLength?: number;
    },
  ) {
    const project = await this.getProjectById(id, orgId);
    if (!project) return null;

    await db
      .insert(projectSettings)
      .values({ projectId: id })
      .onConflictDoNothing();

    await db
      .update(projectSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projectSettings.projectId, id));

    return this.getProjectSettings(id, orgId);
  }

  private defaultProjectSettings(projectId: string) {
    return {
      projectId,
      redactSensitiveData: true,
      captureRequestHeaders: true,
      captureRequestBody: true,
      captureResponseBody: true,
      maxAttributeCount: 100,
      maxAttributeValueLength: 4096,
    };
  }
}
