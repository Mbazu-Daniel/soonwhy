import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { db } from '../../../db';
import { environments } from '../../../db/schema';

@Injectable()
export class EnvironmentsRepository {
  async findEnvironmentById(id: string) {
    return db.query.environments.findFirst({
      where: eq(environments.id, id),
    });
  }

  async findEnvironmentsByProjectId(projectId: string) {
    return db.query.environments.findMany({
      where: eq(environments.projectId, projectId),
    });
  }

  async findEnvironmentByProjectAndSlug(projectId: string, slug: string) {
    return db.query.environments.findFirst({
      where: and(eq(environments.projectId, projectId), eq(environments.slug, slug)),
    });
  }

  async createEnvironment(data: { projectId: string; name: string; slug: string }) {
    const [env] = await db.insert(environments).values(data).returning();
    return env;
  }

  async deleteEnvironment(id: string) {
    await db.delete(environments).where(eq(environments.id, id));
  }
}
