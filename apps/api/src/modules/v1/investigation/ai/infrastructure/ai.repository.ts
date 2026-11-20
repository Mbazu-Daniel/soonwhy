import { Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db } from "../../../../../common/db";
import { aiProviderCredentials, projects, rcaInvocations, usageEvents } from "../../../../../common/db/schema";
import { CHAT_USAGE_SOURCE } from "../investigation-chat/investigation-chat.constants";
import type { ProjectAiSpend, NewCredential, CredentialPatch } from "../domain/ai.repository.types";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function live(orgId: string) {
  return and(eq(aiProviderCredentials.orgId, orgId), isNull(aiProviderCredentials.deletedAt));
}

function clearDefault(tx: Tx, orgId: string) {
  return tx
    .update(aiProviderCredentials)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(live(orgId), eq(aiProviderCredentials.isDefault, true)));
}

@Injectable()
export class AiRepository {
  list(orgId: string) {
    return db
      .select()
      .from(aiProviderCredentials)
      .where(live(orgId))
      .orderBy(desc(aiProviderCredentials.isDefault), asc(aiProviderCredentials.createdAt));
  }

  async find(orgId: string, id: string) {
    const [row] = await db
      .select()
      .from(aiProviderCredentials)
      .where(and(live(orgId), eq(aiProviderCredentials.id, id)))
      .limit(1);
    return row ?? null;
  }

  async get(orgId: string) {
    const [row] = await db
      .select()
      .from(aiProviderCredentials)
      .where(and(live(orgId), eq(aiProviderCredentials.isDefault, true)))
      .limit(1);
    return row ?? null;
  }

  async create(data: NewCredential, makeDefault: boolean) {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: aiProviderCredentials.id })
        .from(aiProviderCredentials)
        .where(live(data.orgId))
        .limit(1);
      const isDefault = makeDefault || !existing;
      if (isDefault) await clearDefault(tx, data.orgId);
      const [row] = await tx
        .insert(aiProviderCredentials)
        .values({ ...data, isDefault })
        .returning();
      return row!;
    });
  }

  async update(orgId: string, id: string, patch: CredentialPatch, makeDefault: boolean) {
    return db.transaction(async (tx) => {
      if (makeDefault) await clearDefault(tx, orgId);
      const [row] = await tx
        .update(aiProviderCredentials)
        .set({
          ...patch,
          ...(makeDefault ? { isDefault: true } : {}),
          verifiedAt: null,
          lastErrorCode: null,
          updatedAt: new Date(),
        })
        .where(and(live(orgId), eq(aiProviderCredentials.id, id)))
        .returning();
      return row ?? null;
    });
  }

  async remove(orgId: string, id: string) {
    return db.transaction(async (tx) => {
      const [removed] = await tx
        .update(aiProviderCredentials)
        .set({ deletedAt: new Date(), enabled: false, isDefault: false, updatedAt: new Date() })
        .where(and(live(orgId), eq(aiProviderCredentials.id, id)))
        .returning({ id: aiProviderCredentials.id });
      if (!removed) return null;
      const [current] = await tx
        .select({ id: aiProviderCredentials.id })
        .from(aiProviderCredentials)
        .where(and(live(orgId), eq(aiProviderCredentials.isDefault, true)))
        .limit(1);
      if (!current) {
        const [oldest] = await tx
          .select({ id: aiProviderCredentials.id })
          .from(aiProviderCredentials)
          .where(live(orgId))
          .orderBy(asc(aiProviderCredentials.createdAt))
          .limit(1);
        if (oldest) {
          await tx
            .update(aiProviderCredentials)
            .set({ isDefault: true, updatedAt: new Date() })
            .where(eq(aiProviderCredentials.id, oldest.id));
        }
      }
      return removed;
    });
  }

  async recordVerification(
    orgId: string,
    id: string,
    result: { verified: boolean; errorCode: string | null },
  ) {
    await db
      .update(aiProviderCredentials)
      .set({
        verifiedAt: result.verified ? new Date() : null,
        lastErrorCode: result.errorCode,
      })
      .where(and(eq(aiProviderCredentials.orgId, orgId), eq(aiProviderCredentials.id, id)));
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

  async getProjectSpend(orgId: string, from: Date, to: Date): Promise<ProjectAiSpend[]> {
    const [rca, chat] = await Promise.all([
      db
        .select({
          projectId: rcaInvocations.projectId,
          runs: sql<number>`count(*)::int`,
          tokens: sql<number>`coalesce(sum(${rcaInvocations.totalTokens}), 0)::float8`,
          costUsd: sql<number>`coalesce(round(sum(${rcaInvocations.estimatedCostUsd})::numeric, 6), 0)::float8`,
        })
        .from(rcaInvocations)
        .where(
          and(
            eq(rcaInvocations.orgId, orgId),
            gte(rcaInvocations.createdAt, from),
            lt(rcaInvocations.createdAt, to),
          ),
        )
        .groupBy(rcaInvocations.projectId),
      db
        .select({
          projectId: usageEvents.projectId,
          tokens: sql<number>`coalesce(sum(${usageEvents.quantity}), 0)::float8`,
          costUsd: sql<number>`coalesce(round(sum((${usageEvents.metadata}->>'costUsd')::numeric), 6), 0)::float8`,
        })
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.orgId, orgId),
            eq(usageEvents.source, CHAT_USAGE_SOURCE),
            isNotNull(usageEvents.projectId),
            gte(usageEvents.occurredAt, from),
            lt(usageEvents.occurredAt, to),
          ),
        )
        .groupBy(usageEvents.projectId),
    ]);

    const ids = [...new Set([...rca.map((row) => row.projectId), ...chat.map((row) => row.projectId!)])];
    if (!ids.length) return [];
    const named = await db
      .select({ id: projects.id, name: projects.name, slug: projects.slug })
      .from(projects)
      .where(and(eq(projects.organizationId, orgId), inArray(projects.id, ids)));

    return named
      .map((project) => {
        const runs = rca.find((row) => row.projectId === project.id);
        const talk = chat.find((row) => row.projectId === project.id);
        return {
          projectId: project.id,
          name: project.name,
          slug: project.slug,
          runs: runs?.runs ?? 0,
          rcaTokens: runs?.tokens ?? 0,
          chatTokens: talk?.tokens ?? 0,
          chatCostUsd: talk?.costUsd ?? 0,
          costUsd: Math.round(((runs?.costUsd ?? 0) + (talk?.costUsd ?? 0)) * 1_000_000) / 1_000_000,
        };
      })
      .sort((a, b) => b.costUsd - a.costUsd || b.rcaTokens + b.chatTokens - (a.rcaTokens + a.chatTokens) || a.name.localeCompare(b.name));
  }

  async getChatCostTotals(orgId: string, from: Date, to: Date) {
    return db
      .select({
        credentialSource: sql<string | null>`${usageEvents.metadata}->>'credentialSource'`,
        costUsd: sql<number>`coalesce(round(sum((${usageEvents.metadata}->>'costUsd')::numeric), 6), 0)::float8`,
      })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.orgId, orgId),
          eq(usageEvents.source, CHAT_USAGE_SOURCE),
          gte(usageEvents.occurredAt, from),
          lt(usageEvents.occurredAt, to),
        ),
      )
      .groupBy(sql`${usageEvents.metadata}->>'credentialSource'`);
  }
}
