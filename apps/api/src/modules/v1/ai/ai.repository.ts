import { Injectable } from "@nestjs/common";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "../../../common/db";
import {
  aiProviderCredentials,
  rcaInvocations,
} from "../../../common/db/schema";

@Injectable()
export class AiRepository {
  async get(orgId: string) {
    return db.query.aiProviderCredentials.findFirst({
      where: and(
        eq(aiProviderCredentials.orgId, orgId),
        isNull(aiProviderCredentials.deletedAt),
      ),
    });
  }

  async upsert(data: {
    orgId: string;
    provider: string;
    model: string;
    baseUrl?: string | null;
    encryptedApiKey: string;
    keyHint: string;
  }) {
    const [row] = await db
      .insert(aiProviderCredentials)
      .values(data)
      .onConflictDoUpdate({
        target: aiProviderCredentials.orgId,
        set: {
          ...data,
          enabled: true,
          deletedAt: null,
          verifiedAt: null,
          lastErrorCode: null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async remove(orgId: string) {
    const [row] = await db
      .update(aiProviderCredentials)
      .set({ deletedAt: new Date(), enabled: false, updatedAt: new Date() })
      .where(
        and(
          eq(aiProviderCredentials.orgId, orgId),
          isNull(aiProviderCredentials.deletedAt),
        ),
      )
      .returning({ id: aiProviderCredentials.id });
    return row ?? null;
  }

  async recordVerification(
    orgId: string,
    result: { verified: boolean; errorCode: string | null },
  ) {
    await db
      .update(aiProviderCredentials)
      .set({
        verifiedAt: result.verified ? new Date() : null,
        lastErrorCode: result.errorCode,
      })
      .where(eq(aiProviderCredentials.orgId, orgId));
  }

  async getInvocationTotals(orgId: string, from: Date, to: Date) {
    return db
      .select({
        credentialSource: rcaInvocations.credentialSource,
        status: rcaInvocations.status,
        runs: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${rcaInvocations.totalTokens}), 0)::int`,
        costUsd: sql<number>`coalesce(sum(${rcaInvocations.estimatedCostUsd}), 0)::float8`,
      })
      .from(rcaInvocations)
      .where(
        and(
          eq(rcaInvocations.orgId, orgId),
          gte(rcaInvocations.createdAt, from),
          lt(rcaInvocations.createdAt, to),
        ),
      )
      .groupBy(rcaInvocations.credentialSource, rcaInvocations.status);
  }
}
