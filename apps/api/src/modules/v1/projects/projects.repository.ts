import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../common/db';
import { projectSettings, projects } from '../../../common/db/schema';

@Injectable()
export class ProjectsRepository {
  async getProjectById(id: string, orgId: string) {
    return db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.orgId, orgId)),
    });
  }

  async getProjectsByOrgId(orgId: string) {
    return db.query.projects.findMany({
      where: eq(projects.orgId, orgId),
    });
  }

  async getProjectByOrgAndSlug(orgId: string, slug: string) {
    return db.query.projects.findFirst({
      where: and(eq(projects.orgId, orgId), eq(projects.slug, slug)),
    });
  }

  async createProject(data: { orgId: string; name: string; slug: string; description?: string }) {
    const [project] = await db.insert(projects).values(data).returning();
    return project;
  }

  async updateProject(id: string, orgId: string, data: { name?: string; description?: string }) {
    const [updated] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.orgId, orgId)))
      .returning();
    return updated;
  }

  async deleteProject(id: string, orgId: string) {
    await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.orgId, orgId)));
  }
}

  async getProjectSettings(id: string, orgId: string) {
    return db
      .select({
        projectId: projectSettings.projectId,
        redactSensitiveData: projectSettings.redactSensitiveData,
        captureRequestHeaders: projectSettings.captureRequestHeaders,
        captureRequestBody: projectSettings.captureRequestBody,
        captureResponseBody: projectSettings.captureResponseBody,
        maxAttributeCount: projectSettings.maxAttributeCount,
        maxAttributeValueLength: projectSettings.maxAttributeValueLength,
      })
      .from(projectSettings)
      .innerJoin(projects, eq(projectSettings.projectId, projects.id))
      .where(and(eq(projectSettings.projectId, id), eq(projects.orgId, orgId)))
      .then((rows) => rows[0] ?? this.defaultProjectSettings(id));
  }

  async updateProjectSettings(id: string, orgId: string, data: Record<string, unknown>) {
    const project = await this.getProjectById(id, orgId);
    if (!project) return null;
    const [settings] = await db
      .insert(projectSettings)
      .values({ projectId: id })
      .onConflictDoNothing()
      .returning();
    if (!settings) {
      await db.update(projectSettings).set({ ...data, updatedAt: new Date() }).where(eq(projectSettings.projectId, id));
    } else if (Object.keys(data).length) {
      await db.update(projectSettings).set({ ...data, updatedAt: new Date() }).where(eq(projectSettings.projectId, id));
    }
    return this.getProjectSettings(id, orgId);
  }

  private defaultProjectSettings(projectId: string) {
    return {
      projectId,
      redactSensitiveData: true,
      captureRequestHeaders: false,
      captureRequestBody: false,
      captureResponseBody: false,
      maxAttributeCount: 100,
      maxAttributeValueLength: 4096,
    };
  }
