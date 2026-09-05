import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { apiKeys, projects } from '../db/schema';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

export interface ValidatedApiKey {
  projectId: string;
  organizationId: string;
  scopes: string[];
}

/**
 * Edge API-key validation for ingest (and any other caller that has DATABASE_URL).
 * Call locally at the ingest edge — do not proxy OTLP auth through apps/api.
 */
@Injectable()
export class ApiKeysService {
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  async validateKey(rawKey: string): Promise<ValidatedApiKey | null> {
    const keyHash = this.hashKey(rawKey);
    const rows = await db
      .select({
        projectId: apiKeys.projectId,
        scopes: apiKeys.scopes,
        expiresAt: apiKeys.expiresAt,
        organizationId: projects.orgId,
      })
      .from(apiKeys)
      .innerJoin(projects, eq(apiKeys.projectId, projects.id))
      .where(eq(apiKeys.keyHash, keyHash));

    const key = rows[0];
    if (!key) return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;

    return {
      projectId: key.projectId,
      organizationId: key.organizationId,
      scopes: key.scopes || [],
    };
  }
}

export function apiKeyFromAuthorization(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
