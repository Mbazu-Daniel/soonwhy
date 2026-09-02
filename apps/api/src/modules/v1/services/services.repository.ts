import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { db } from '../../../common/db';
import { services } from '../../../common/db/schema';

@Injectable()
export class ServicesRepository {
  async findServiceById(id: string) {
    return db.query.services.findFirst({
      where: eq(services.id, id),
    });
  }

  async findServicesByProjectId(projectId: string) {
    return db.query.services.findMany({
      where: eq(services.projectId, projectId),
    });
  }

  async findServiceByProjectAndSlug(projectId: string, slug: string) {
    return db.query.services.findFirst({
      where: and(eq(services.projectId, projectId), eq(services.slug, slug)),
    });
  }

  async createService(data: { projectId: string; name: string; slug: string }) {
    const [svc] = await db.insert(services).values(data).returning();
    return svc;
  }

  async deleteService(id: string) {
    await db.delete(services).where(eq(services.id, id));
  }
}
