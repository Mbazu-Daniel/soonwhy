import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../../../common/db';
import { organizations } from '../../../common/db/schema';

@Injectable()
export class OrganizationsRepository {
  async getOrganizationById(id: string) {
    return db.query.organizations.findFirst({
      where: eq(organizations.id, id),
    });
  }

  async getOrganizationBySlug(slug: string) {
    return db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    });
  }

  async createOrganization(data: { name: string; slug: string; logo?: string }) {
    const [org] = await db.insert(organizations).values(data).returning();
    return org;
  }

  async updateOrganization(id: string, data: { name?: string; slug?: string; logo?: string }) {
    const [updated] = await db
      .update(organizations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return updated;
  }

  async deleteOrganization(id: string) {
    await db.delete(organizations).where(eq(organizations.id, id));
  }
}
