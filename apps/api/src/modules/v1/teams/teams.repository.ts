import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../common/db';
import { organizations, teams } from '../../../common/db/schema';

@Injectable()
export class TeamsRepository {
  async list(orgId: string) {
    return db.select({ team: teams }).from(teams).innerJoin(organizations, eq(teams.orgId, organizations.id))
      .where(eq(organizations.id, orgId));
  }

  async findBySlug(orgId: string, slug: string) {
    const [row] = await db.select({ team: teams }).from(teams)
      .where(and(eq(teams.orgId, orgId), eq(teams.slug, slug))).limit(1);
    return row?.team;
  }

  async create(orgId: string, input: { name: string; slug: string }) {
    const [team] = await db.insert(teams).values({ orgId, ...input }).returning();
    return team;
  }
}
