// fallow-ignore-file unused-class-member
// Members are consumed via narrowed Pick<AiRepository> DI injection, which fallow cannot see through.
import { Injectable } from "@nestjs/common";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "../../../common/db";
import {
  aiProviderCredentials,
  rcaInvocations,
} from "../../../common/db/schema";

@Injectable()
export class AiRepository {
  /** The live credential. A soft-deleted row stays for audit and never resolves. */
  async get(orgId: string) {
    return db.query.aiProviderCredentials.findFirst({
      where: and(
        eq(aiProviderCredentials.orgId, orgId),
        isNull(aiProviderCredentials.deletedAt),
      ),
    });
  }

  /** Saving over a removed credential revives its row, which the unique index needs. */
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

  /** Runs in the period, split by the credential that paid for them. */
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
