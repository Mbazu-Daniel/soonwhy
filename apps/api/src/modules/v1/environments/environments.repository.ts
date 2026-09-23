import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../common/db';
import { environments, projects } from '../../../common/db/schema';

@Injectable()
export class EnvironmentsRepository {
  async list(projectId: string, orgId: string) {
    return db
      .select({ environment: environments })
      .from(environments)
      .innerJoin(projects, eq(environments.projectId, projects.id))
      .where(and(eq(environments.projectId, projectId), eq(projects.orgId, orgId)));
  }

  async projectBelongsToOrg(projectId: string, orgId: string) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
      .limit(1);
    return !!project;
  }

  async findBySlug(projectId: string, orgId: string, slug: string) {
    const [row] = await db
      .select({ environment: environments })
      .from(environments)
      .innerJoin(projects, eq(environments.projectId, projects.id))
      .where(and(eq(environments.projectId, projectId), eq(projects.orgId, orgId), eq(environments.slug, slug)))
      .limit(1);
    return row?.environment;
  }

  async create(projectId: string, input: { name: string; slug: string; kind: string }) {
    const [environment] = await db.insert(environments).values({ projectId, ...input }).returning();
    return environment;
  }
}
