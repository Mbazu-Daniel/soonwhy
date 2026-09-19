import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../common/db';
import { projects } from '../../../common/db/schema';

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
