import { Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../../common/db';
import { deployments, environments, projects, services } from '../../../common/db/schema';

@Injectable()
export class DeploymentsRepository {
  async list(serviceId: string, orgId: string) {
    return db
      .select({ deployment: deployments })
      .from(deployments)
      .innerJoin(services, eq(deployments.serviceId, services.id))
      .innerJoin(projects, eq(services.projectId, projects.id))
      .where(and(eq(deployments.serviceId, serviceId), eq(services.orgId, orgId), eq(projects.orgId, orgId)))
      .orderBy(desc(deployments.deployedAt));
  }

  async create(input: CreateDeploymentInput & { orgId: string }) {
    const [deployment] = await db.insert(deployments).values({
      serviceId: input.serviceId,
      environmentId: input.environmentId,
      version: input.version,
      commitSha: input.commitSha,
      status: input.status,
      deployedAt: input.deployedAt,
    }).returning();
    return deployment;
  }

  async belongsToTenant(serviceId: string, environmentId: string, orgId: string) {
    const [row] = await db
      .select({ serviceId: services.id })
      .from(services)
      .innerJoin(projects, eq(services.projectId, projects.id))
      .innerJoin(environments, eq(environments.projectId, projects.id))
      .where(and(
        eq(services.id, serviceId),
        eq(environments.id, environmentId),
        eq(services.orgId, orgId),
        eq(projects.orgId, orgId),
      ))
      .limit(1);
    return !!row;
  }
}

type CreateDeploymentInput = {
  serviceId: string;
  environmentId: string;
  version?: string;
  commitSha?: string;
  status: string;
  deployedAt?: Date;
};
