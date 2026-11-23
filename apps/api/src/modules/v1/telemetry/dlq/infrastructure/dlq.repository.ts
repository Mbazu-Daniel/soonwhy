import { Injectable } from "@nestjs/common";
import { db } from "../../../../../common/db";
import { deadLetterQueue, deadLetterQueueAttempts } from "../../../../../common/db/schema";
import { eq, desc, and, or, lt, ne, inArray, sql } from "drizzle-orm";
import { DLQ_ATTEMPT_OUTCOME, DLQ_REPLAY_STATUS, MAX_REPLAY_ATTEMPTS, REPLAY_LEASE_SECONDS } from "../domain/dlq.constants";

const inOrganization = (organizationId?: string) =>
  organizationId ? eq(deadLetterQueue.organizationId, organizationId) : undefined;

@Injectable()
export class DlqRepository {
  async createDlqEntry(data: {
    signal: string;
    deliveryCount: number;
    reason: string;
    payload: unknown;
    organizationId?: string;
    projectId?: string;
  }) {
    const [entry] = await db
      .insert(deadLetterQueue)
      .values({
        signal: data.signal,
        deliveryCount: data.deliveryCount,
        reason: data.reason,
        payload: data.payload,
        organizationId: data.organizationId,
        projectId: data.projectId,
      })
      .returning();
    return entry;
  }

  async getDlqEntries(limit: number = 100, offset: number = 0, organizationId?: string) {
    return db
      .select()
      .from(deadLetterQueue)
      .where(inOrganization(organizationId))
      .orderBy(desc(deadLetterQueue.failedAt))
      .limit(limit)
      .offset(offset);
  }

  async getDlqEntryById(id: number, organizationId?: string) {
    const [entry] = await db
      .select()
      .from(deadLetterQueue)
      .where(and(eq(deadLetterQueue.id, id), inOrganization(organizationId)))
      .limit(1);
    return entry;
  }

  async getDlqStats() {
    const status = deadLetterQueue.replayStatus;
    const [stats] = await db
      .select({
        total: sql<number>`count(*)`,
        unreplayed: sql<number>`count(*) filter (where ${status} = ${DLQ_REPLAY_STATUS.pending})`,
        replaying: sql<number>`count(*) filter (where ${status} = ${DLQ_REPLAY_STATUS.replaying})`,
        successful: sql<number>`count(*) filter (where ${status} = ${DLQ_REPLAY_STATUS.succeeded})`,
        failed: sql<number>`count(*) filter (where ${status} = ${DLQ_REPLAY_STATUS.failed})`,
      })
      .from(deadLetterQueue);
    return stats;
  }

  async claimReplay(id: number, actor: string, force = false, organizationId?: string) {
    return db.transaction(async (tx) => {
      const [entry] = await tx
        .update(deadLetterQueue)
        .set({
          replayStatus: DLQ_REPLAY_STATUS.replaying,
          replayLeaseExpiresAt: sql`now() + make_interval(secs => ${REPLAY_LEASE_SECONDS})`,
          replayAttempts: sql`coalesce(${deadLetterQueue.replayAttempts}, 0) + 1`,
          replayedAt: new Date(),
          replayError: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(deadLetterQueue.id, id),
            inOrganization(organizationId),
            force ? undefined : sql`coalesce(${deadLetterQueue.replayAttempts}, 0) < ${MAX_REPLAY_ATTEMPTS}`,
            or(
              inArray(deadLetterQueue.replayStatus, [DLQ_REPLAY_STATUS.pending, DLQ_REPLAY_STATUS.failed]),
              and(
                eq(deadLetterQueue.replayStatus, DLQ_REPLAY_STATUS.replaying),
                lt(deadLetterQueue.replayLeaseExpiresAt, sql`now()`),
              ),
            ),
          ),
        )
        .returning();
      if (!entry) return undefined;

      await tx
        .update(deadLetterQueueAttempts)
        .set({ outcome: DLQ_ATTEMPT_OUTCOME.abandoned, finishedAt: sql`now()` })
        .where(
          and(
            eq(deadLetterQueueAttempts.entryId, id),
            eq(deadLetterQueueAttempts.outcome, DLQ_ATTEMPT_OUTCOME.started),
          ),
        );
      const attemptNumber = entry.replayAttempts ?? 1;
      await tx.insert(deadLetterQueueAttempts).values({
        entryId: id,
        attemptNumber,
        triggeredBy: actor,
        forced: attemptNumber > MAX_REPLAY_ATTEMPTS,
      });
      return entry;
    });
  }

  async finalizeReplay(id: number, attempt: number, success: boolean, error?: string) {
    return db.transaction(async (tx) => {
      await tx
        .update(deadLetterQueueAttempts)
        .set({
          outcome: success ? DLQ_ATTEMPT_OUTCOME.succeeded : DLQ_ATTEMPT_OUTCOME.failed,
          finishedAt: sql`now()`,
          error: error ?? null,
        })
        .where(
          and(
            eq(deadLetterQueueAttempts.entryId, id),
            eq(deadLetterQueueAttempts.attemptNumber, attempt),
            eq(deadLetterQueueAttempts.outcome, DLQ_ATTEMPT_OUTCOME.started),
          ),
        );
      const [entry] = await tx
        .update(deadLetterQueue)
        .set({
          replayStatus: success ? DLQ_REPLAY_STATUS.succeeded : DLQ_REPLAY_STATUS.failed,
          replayLeaseExpiresAt: null,
          replayedAt: new Date(),
          replayError: error ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(deadLetterQueue.id, id),
            eq(deadLetterQueue.replayStatus, DLQ_REPLAY_STATUS.replaying),
            eq(deadLetterQueue.replayAttempts, attempt),
          ),
        )
        .returning();
      return entry;
    });
  }

  async getAttempts(entryId: number) {
    return db
      .select()
      .from(deadLetterQueueAttempts)
      .where(eq(deadLetterQueueAttempts.entryId, entryId))
      .orderBy(desc(deadLetterQueueAttempts.attemptNumber));
  }

  async deleteUnlessReplaying(ids: number[], organizationId?: string) {
    const deleted = await db
      .delete(deadLetterQueue)
      .where(
        and(
          inArray(deadLetterQueue.id, ids),
          inOrganization(organizationId),
          ne(deadLetterQueue.replayStatus, DLQ_REPLAY_STATUS.replaying),
        ),
      )
      .returning({ id: deadLetterQueue.id });
    const deletedIds = deleted.map((row) => row.id);
    const remaining = await db
      .select({ id: deadLetterQueue.id })
      .from(deadLetterQueue)
      .where(and(inArray(deadLetterQueue.id, ids), inOrganization(organizationId)));
    return { deleted: deletedIds, refused: remaining.map((row) => row.id) };
  }

  async deleteSucceededEntries(daysOld: number) {
    const deleted = await db
      .delete(deadLetterQueue)
      .where(
        and(
          eq(deadLetterQueue.replayStatus, DLQ_REPLAY_STATUS.succeeded),
          sql`${deadLetterQueue.replayedAt} < now() - make_interval(days => ${daysOld})`,
        ),
      )
      .returning({ id: deadLetterQueue.id });
    return deleted.length;
  }
}
