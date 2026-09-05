import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import { db } from '../../../common/db';
import { apiKeys } from '../../../common/db/schema';

@Injectable()
export class ApiKeysRepository {
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private generateKey(): string {
    return randomBytes(32).toString('hex');
  }

  async getApiKeyById(id: string) {
    return db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, id),
    });
  }

  async getApiKeysByProjectId(projectId: string) {
    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.projectId, projectId),
    });
    // eslint-disable-next-line no-unused-vars
    return keys.map(({ keyHash: _, ...rest }) => rest);
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
