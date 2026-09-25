import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../../../common/db';
import { aiProviderCredentials } from '../../../common/db/schema';

@Injectable()
export class AiRepository {
  async get(orgId: string) { return db.query.aiProviderCredentials.findFirst({ where: eq(aiProviderCredentials.orgId, orgId) }); }
  async upsert(data: { orgId: string; provider: string; model: string; baseUrl?: string | null; encryptedApiKey: string; keyHint: string; }) {
    const existing = await this.get(data.orgId);
    if (existing) {
      const [updated] = await db.update(aiProviderCredentials).set({ ...data, updatedAt: new Date() }).where(eq(aiProviderCredentials.orgId, data.orgId)).returning();
      return updated;
    }
    const [created] = await db.insert(aiProviderCredentials).values(data).returning();
    return created;
  }
  async remove(orgId: string) { await db.delete(aiProviderCredentials).where(eq(aiProviderCredentials.orgId, orgId)); }
}
