// fallow-ignore-file unused-class-member
// Members are consumed via narrowed DI injection, which fallow cannot see through.
import { Injectable } from "@nestjs/common";
import { db } from "../../../common/db";
import { deadLetterQueue } from "../../../common/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

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

  async getDlqEntries(limit: number = 100, offset: number = 0) {
    return db
      .select()
      .from(deadLetterQueue)
      .orderBy(desc(deadLetterQueue.failedAt))
      .limit(limit)
      .offset(offset);
  }

  async getDlqEntryById(id: number) {
    const [entry] = await db
      .select()
      .from(deadLetterQueue)
      .where(eq(deadLetterQueue.id, id))
      .limit(1);
    return entry;
  }

  async getDlqStats() {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)`,
        unreplayed: sql<number>`count(*) filter (where ${deadLetterQueue.replayed} = false)`,
        replayed: sql<number>`count(*) filter (where ${deadLetterQueue.replayed} = true)`,
        successful: sql<number>`count(*) filter (where ${deadLetterQueue.replaySuccess} = true)`,
        failed: sql<number>`count(*) filter (where ${deadLetterQueue.replaySuccess} = false)`,
      })
      .from(deadLetterQueue);
    return stats;
  }

  async claimReplay(id: number) {
    const [entry] = await db
      .update(deadLetterQueue)
      .set({
        replayAttempts: sql`${deadLetterQueue.replayAttempts} + 1`,
        replayedAt: new Date(),
        replaySuccess: null,
        replayError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(deadLetterQueue.id, id),
          sql`not (${deadLetterQueue.replayed} = true and ${deadLetterQueue.replaySuccess} = true)`,
        ),
      )
      .returning();
    return entry;
  }

  async finalizeReplay(id: number, success: boolean, error?: string) {
    const [entry] = await db
      .update(deadLetterQueue)
      .set({
        replayed: true,
        replayedAt: new Date(),
        replaySuccess: success,
        replayError: error ?? null,
        updatedAt: new Date(),
      })
      .where(eq(deadLetterQueue.id, id))
      .returning();
    return entry;
  }

  async deleteDlqEntry(id: number) {
    await db.delete(deadLetterQueue).where(eq(deadLetterQueue.id, id));
  }

  async deleteReplayedEntries(daysOld: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    await db
      .delete(deadLetterQueue)
      .where(
        and(
          eq(deadLetterQueue.replayed, true),
          sql`${deadLetterQueue.replayedAt} < ${cutoffDate.toISOString()}`
        )
      );
  }

  async bulkDelete(ids: number[]) {
    await db
      .delete(deadLetterQueue)
      .where(sql`${deadLetterQueue.id} = any(${ids})`);
  }
}
