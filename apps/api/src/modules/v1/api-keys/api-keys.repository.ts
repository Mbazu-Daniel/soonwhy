import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import { db } from '../../../common/db';
import { apiKeys, projects } from '../../../common/db/schema';

@Injectable()
export class ApiKeysRepository {
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private generateKey(): string {
    return randomBytes(32).toString('hex');
  }

  async getProject(projectId: string, orgId: string) {
    return db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
    });
  }

  async getApiKeyById(id: string, orgId: string) {
    const [result] = await db
      .select({ apiKey: apiKeys })
      .from(apiKeys)
      .innerJoin(projects, eq(apiKeys.projectId, projects.id))
      .where(and(eq(apiKeys.id, id), eq(projects.orgId, orgId)))
      .limit(1);
    return result?.apiKey;
  }

  async getApiKeysByProjectId(projectId: string, orgId: string) {
    const project = await this.getProject(projectId, orgId);
    if (!project) return [];

    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.projectId, projectId),
    });
    return keys.map((key) => {
      const sanitized = { ...key };
      delete sanitized.keyHash;
      return sanitized;
    });
  }

  async getApiKeyByHash(keyHash: string) {
    return db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyHash, keyHash),
    });
  }

  async createApiKey(data: {
    projectId: string;
    name: string;
    scopes: string[];
    expiresAt?: Date;
  }) {
    const rawKey = this.generateKey();
    const prefix = rawKey.substring(0, 8);
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
      })
      .returning();

    return { ...apiKey, key: rawKey };
  }

  async deleteApiKey(id: string) {
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
  }

  async updateLastUsedAt(id: string) {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  hash(key: string): string {
    return this.hashKey(key);
  }
}
