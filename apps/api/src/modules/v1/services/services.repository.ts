import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../common/db';
import { projects, services } from '../../../common/db/schema';

@Injectable()
export class ServicesRepository {
  async getServiceById(id: string, orgId: string) {
    const [result] = await db
      .select({ service: services })
      .from(services)
      .innerJoin(projects, eq(services.projectId, projects.id))
      .where(and(eq(services.id, id), eq(projects.orgId, orgId)))
      .limit(1);
    return result?.service;
  }

  async getServicesByProjectId(projectId: string, orgId: string) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
      .limit(1);
    if (!project) return [];

    return db.query.services.findMany({
      where: eq(services.projectId, projectId),
    });
  }

  async getServiceByProjectAndSlug(projectId: string, orgId: string, slug: string) {
    const [result] = await db
      .select({ service: services })
      .from(services)
      .innerJoin(projects, eq(services.projectId, projects.id))
      .where(
        and(
          eq(services.projectId, projectId),
          eq(projects.orgId, orgId),
          eq(services.slug, slug),
        ),
      )
      .limit(1);
    return result?.service;
  }

  async createService(data: { projectId: string; name: string; slug: string }) {
    const [svc] = await db.insert(services).values(data).returning();
    return svc;
  }

  async deleteService(id: string, orgId: string) {
    await db
      .delete(services)
      .where(
        and(
          eq(services.id, id),
          eq(
            services.projectId,
            db
              .select({ id: projects.id })
              .from(projects)
              .where(and(eq(projects.orgId, orgId), eq(projects.id, services.projectId)))
              .limit(1),
          ),
        ),
      );
  }
}
