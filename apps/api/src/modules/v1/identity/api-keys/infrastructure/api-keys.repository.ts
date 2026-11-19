import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { db } from "../../../../../common/db";
import { apiKeys, projects } from "../../../../../common/db/schema";

@Injectable()
export class ApiKeysRepository {
  private hashKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }

  private generateKey(): string {
    return `soonwhy_${randomBytes(32).toString("base64url")}`;
  }

  async getProject(projectId: string, orgId: string) {
    return db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.organizationId, orgId)),
    });
  }

  async getApiKeyById(id: string, orgId: string) {
    const [result] = await db
      .select({ apiKey: apiKeys })
      .from(apiKeys)
      .innerJoin(projects, eq(apiKeys.projectId, projects.id))
      .where(and(eq(apiKeys.id, id), eq(projects.organizationId, orgId)))
      .limit(1);
    return result?.apiKey;
  }

  async getApiKeysByProjectId(projectId: string, orgId: string) {
    const project = await this.getProject(projectId, orgId);
    if (!project) return [];

    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.projectId, projectId),
    });
    return keys.map(
      (key) =>
        Object.fromEntries(
          Object.entries(key).filter(([name]) => name !== "keyHash"),
        ) as Omit<typeof key, "keyHash">,
    );
  }

  async createApiKey(data: {
    projectId: string;
    name: string;
    scopes: string[];
    expiresAt?: Date;
    serviceAccountId?: string;
  }) {
    const rawKey = this.generateKey();
    const prefix = rawKey.substring(0, 15);
    const keyHash = this.hashKey(rawKey);

    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        projectId: data.projectId,
        name: data.name,
        prefix,
        keyHash,
        scopes: data.scopes,
        expiresAt: data.expiresAt ?? null,
        serviceAccountId: data.serviceAccountId ?? null,
      })
      .returning();

    return { ...apiKey, key: rawKey };
  }

  async deleteApiKey(id: string) {
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
  }

}
