import { Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../../../common/db";
import { apiKeys, projects, serviceAccounts } from "../../../../../common/db/schema";

@Injectable()
export class ServiceAccountsRepository {
  async list(orgId: string) {
    return db
      .select({
        id: serviceAccounts.id,
        name: serviceAccounts.name,
        description: serviceAccounts.description,
        disabledAt: serviceAccounts.disabledAt,
        createdAt: serviceAccounts.createdAt,
        keyCount: sql<number>`(select count(*)::int from ${apiKeys} where ${apiKeys.serviceAccountId} = ${serviceAccounts.id})`,
      })
      .from(serviceAccounts)
      .where(eq(serviceAccounts.organizationId, orgId))
      .orderBy(serviceAccounts.name);
  }

  async find(orgId: string, id: string) {
    const [row] = await db
      .select()
      .from(serviceAccounts)
      .where(and(eq(serviceAccounts.id, id), eq(serviceAccounts.organizationId, orgId)))
      .limit(1);
    return row;
  }

  async create(data: { orgId: string; name: string; description?: string; createdBy?: string }) {
    const [row] = await db
      .insert(serviceAccounts)
      .values({
        organizationId: data.orgId,
        name: data.name,
        description: data.description ?? null,
        createdBy: data.createdBy ?? null,
      })
      .onConflictDoNothing()
      .returning();
    return row;
  }

  async setDisabled(orgId: string, id: string, disabled: boolean) {
    const [row] = await db
      .update(serviceAccounts)
      .set({ disabledAt: disabled ? new Date() : null })
      .where(and(eq(serviceAccounts.id, id), eq(serviceAccounts.organizationId, orgId)))
      .returning();
    return row;
  }

  async remove(orgId: string, id: string) {
    const rows = await db
      .delete(serviceAccounts)
      .where(and(eq(serviceAccounts.id, id), eq(serviceAccounts.organizationId, orgId)))
      .returning({ id: serviceAccounts.id });
    return rows.length > 0;
  }

  async keys(serviceAccountId: string) {
    return db
      .select({
        id: apiKeys.id,
        projectId: apiKeys.projectId,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        scopes: apiKeys.scopes,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.serviceAccountId, serviceAccountId));
  }

  async projectIds(orgId: string, ids: string[]) {
    if (ids.length === 0) return [];
    const rows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.organizationId, orgId), inArray(projects.id, ids)));
    return rows.map((row) => row.id);
  }
}
