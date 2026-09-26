import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../common/db';
import { businessOperations, environments, projects, services } from '../../../common/db/schema';

@Injectable()
export class BusinessOperationsRepository {
  async list(projectId: string, orgId: string) {
    return db
      .select({ operation: businessOperations })
      .from(businessOperations)
      .innerJoin(projects, eq(businessOperations.projectId, projects.id))
      .where(and(
        eq(businessOperations.projectId, projectId),
        eq(businessOperations.orgId, orgId),
        eq(projects.orgId, orgId),
      ))
      .orderBy(businessOperations.name);
  }

  async getById(id: string, orgId: string) {
    const [row] = await db
      .select({ operation: businessOperations })
      .from(businessOperations)
      .innerJoin(projects, eq(businessOperations.projectId, projects.id))
      .where(and(
        eq(businessOperations.id, id),
        eq(businessOperations.orgId, orgId),
        eq(projects.orgId, orgId),
      ))
      .limit(1);
    return row?.operation;
  }

  async findBySlug(projectId: string, orgId: string, slug: string) {
    const [row] = await db
      .select({ operation: businessOperations })
      .from(businessOperations)
      .innerJoin(projects, eq(businessOperations.projectId, projects.id))
      .where(and(
        eq(businessOperations.projectId, projectId),
        eq(businessOperations.orgId, orgId),
        eq(projects.orgId, orgId),
        eq(businessOperations.slug, slug),
      ))
      .limit(1);
    return row?.operation;
  }

  async validateContext(
    orgId: string,
    projectId: string,
    serviceId: string,
    environmentId?: string,
  ) {
    const [service] = await db
      .select({ id: services.id })
      .from(services)
      .innerJoin(projects, eq(services.projectId, projects.id))
      .where(and(
        eq(services.id, serviceId),
        eq(services.projectId, projectId),
        eq(services.orgId, orgId),
        eq(projects.id, projectId),
        eq(projects.orgId, orgId),
      ))
      .limit(1);

    if (!service) return false;

    if (!environmentId) return true;

    const [environment] = await db
      .select({ id: environments.id })
      .from(environments)
      .innerJoin(projects, eq(environments.projectId, projects.id))
      .where(and(
        eq(environments.id, environmentId),
        eq(environments.projectId, projectId),
        eq(projects.orgId, orgId),
      ))
      .limit(1);

    return Boolean(environment);
  }

  async create(
    orgId: string,
    projectId: string,
    input: Omit<{
      name: string;
      slug: string;
      serviceId: string;
      environmentId?: string;
      description?: string;
      method?: string;
      routePattern?: string;
      criticality: string;
      sloMetric?: string;
      sloTarget?: number;
      sloUnit?: string;
    }, 'environmentId'> & { environmentId?: string },
  ) {
    const [operation] = await db.insert(businessOperations).values({
      orgId,
      projectId,
      ...input,
    }).returning();
    return operation;
  }
}
