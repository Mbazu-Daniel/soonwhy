import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { db } from '../../../db';
import { projects } from '../../../db/schema';

@Injectable()
export class ProjectsRepository {
  async findProjectById(id: string) {
    return db.query.projects.findFirst({
      where: eq(projects.id, id),
    });
  }

  async findProjectsByOrgId(orgId: string) {
    return db.query.projects.findMany({
      where: eq(projects.orgId, orgId),
    });
  }

  async findProjectByOrgAndSlug(orgId: string, slug: string) {
    return db.query.projects.findFirst({
      where: and(eq(projects.orgId, orgId), eq(projects.slug, slug)),
    });
  }

  async createProject(data: { orgId: string; name: string; slug: string; description?: string }) {
    const [project] = await db.insert(projects).values(data).returning();
    return project;
  }

  async updateProject(id: string, data: { name?: string; description?: string }) {
    const [updated] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: string) {
    await db.delete(projects).where(eq(projects.id, id));
  }
}
