import { Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../../common/db";
import { invitations, members, organizations } from "../../../common/db/schema";

@Injectable()
export class OrganizationsRepository {
  async getOrganizationById(id: string) {
    return db.query.organizations.findFirst({
      where: and(eq(organizations.id, id), isNull(organizations.deletedAt)),
    });
  }

  async getOrganizationBySlug(slug: string) {
    return db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    });
  }

  async updateOrganization(
    id: string,
    data: { name?: string; slug?: string; logo?: string },
  ) {
    const [updated] = await db
      .update(organizations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return updated;
  }

  async deleteOrganization(id: string) {
    const [deleted] = await db
      .update(organizations)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
      .returning();
    return deleted;
  }

  async getActiveOrganizationIds(ids: string[]) {
    if (ids.length === 0) return [];
    const rows = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(
        and(inArray(organizations.id, ids), isNull(organizations.deletedAt)),
      );
    return rows.map((row) => row.id);
  }

  async getMemberByUserId(organizationId: string, userId: string) {
    return db.query.members.findFirst({
      where: and(
        eq(members.organizationId, organizationId),
        eq(members.userId, userId),
      ),
    });
  }

  async getInvitationById(invitationId: string) {
    return db.query.invitations.findFirst({
      where: eq(invitations.id, invitationId),
    });
  }

  async getMemberById(organizationId: string, memberId: string) {
    return db.query.members.findFirst({
      where: and(
        eq(members.organizationId, organizationId),
        eq(members.id, memberId),
      ),
    });
  }

  async updateMember(
    organizationId: string,
    memberId: string,
    data: { name?: string | null },
  ) {
    const [updated] = await db
      .update(members)
      .set(data)
      .where(and(eq(members.id, memberId), eq(members.organizationId, organizationId)))
      .returning();
    return updated;
  }
}
