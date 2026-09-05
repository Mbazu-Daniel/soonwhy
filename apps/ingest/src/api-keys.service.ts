import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { apiKeys } from './db.schema';
import { eq } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

@Injectable()
export class ApiKeysService {
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  async validateKey(rawKey: string): Promise<{ projectId: string; scopes: string[] } | null> {
    const keyHash = this.hashKey(rawKey);
    const rows = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
    const key = rows[0];
    if (!key) return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;
    return { projectId: key.projectId, scopes: key.scopes || [] };
  }
}
