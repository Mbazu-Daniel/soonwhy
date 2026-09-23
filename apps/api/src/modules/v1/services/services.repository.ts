import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../common/db';
import { projects, services, teams, users } from '../../../common/db/schema';

@Injectable()
export class ServicesRepository {
  async getServiceById(id: string, orgId: string) {
    const [result] = await db
      .select({
        service: services,
        owner: { id: users.id, name: users.name, email: users.email },
        team: { id: teams.id, name: teams.name, slug: teams.slug },
      })
      .from(services)
      .innerJoin(projects, eq(services.projectId, projects.id))
      .leftJoin(users, eq(services.ownerId, users.id))
      .leftJoin(teams, eq(services.teamId, teams.id))
      .where(and(eq(services.id, id), eq(services.orgId, orgId), eq(projects.orgId, orgId)))
      .limit(1);
    if (!result) return undefined;
    return { ...result.service, owner: result.owner, team: result.team };
  }

  async getServicesByProjectId(projectId: string, orgId: string) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
      .limit(1);
    if (!project) return [];

    const rows = await db
      .select({
        service: services,
        owner: { id: users.id, name: users.name, email: users.email },
        team: { id: teams.id, name: teams.name, slug: teams.slug },
      })
      .from(services)
      .leftJoin(users, eq(services.ownerId, users.id))
      .leftJoin(teams, eq(services.teamId, teams.id))
      .where(and(eq(services.projectId, projectId), eq(services.orgId, orgId)));

    return rows.map(({ service, owner, team }) => ({ ...service, owner, team }));
  }

  async getServiceByProjectAndSlug(projectId: string, orgId: string, slug: string) {
    const [result] = await db
      .select({ service: services })
      .from(services)
      .innerJoin(projects, eq(services.projectId, projects.id))
      .where(and(eq(services.projectId, projectId), eq(services.orgId, orgId), eq(projects.orgId, orgId), eq(services.slug, slug)))
      .limit(1);
    return result?.service;
  }

  async createService(data: {
    projectId: string;
    orgId: string;
    name: string;
    slug: string;
    language?: string;
    framework?: string;
    repositoryUrl?: string;
    repositoryProvider?: string;
    repositoryBranch?: string;
    ownerId?: string;
    teamId?: string;
  }) {
    const [svc] = await db.insert(services).values(data).returning();
    return svc;
  }

  async deleteService(id: string) {
    await db.delete(services).where(eq(services.id, id));
  }
}
