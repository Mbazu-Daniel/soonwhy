import { Inject, Injectable } from "@nestjs/common";
import { DB, ingestEventReceipts, type Db } from "@soonwhy/shared";
import { and, eq, lt, sql, inArray } from "drizzle-orm";
import { CLAIM_LEASE_MS } from "./constants";

export type ReceiptClaim = "claimed" | "committed" | "busy";

export class ReceiptBusyError extends Error {
  constructor(eventId: string) {
    super(`Ingest receipt is leased by another worker: ${eventId}`);
  }
}

@Injectable()
export class IngestReceiptRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async claim(
    eventId: string,
    organizationId: string,
    projectId: string,
    signal: string,
  ): Promise<ReceiptClaim> {
    const cutoff = new Date(Date.now() - CLAIM_LEASE_MS);
    const [claimed] = await this.db
      .insert(ingestEventReceipts)
      .values({ eventId, organizationId, projectId, signal })
      .onConflictDoUpdate({
        target: ingestEventReceipts.eventId,
        set: {
          status: "pending",
          attempts: sql`${ingestEventReceipts.attempts} + 1`,
          updatedAt: new Date(),
        },
        setWhere: and(
          eq(ingestEventReceipts.status, "pending"),
          lt(ingestEventReceipts.updatedAt, cutoff),
        ),
      })
      .returning({ eventId: ingestEventReceipts.eventId });
    if (claimed) return "claimed";

    const [existing] = await this.db
      .select({ status: ingestEventReceipts.status })
      .from(ingestEventReceipts)
      .where(eq(ingestEventReceipts.eventId, eventId))
      .limit(1);
    if (!existing) return "busy";
    return existing.status === "committed" ? "committed" : "busy";
  }

  async claimBatch(
    eventIds: string[],
    organizationId: string,
    projectId: string,
    signal: string,
  ): Promise<{ claimed: Set<string>; committed: Set<string>; busy: Set<string> }> {
    if (eventIds.length === 0) {
      return { claimed: new Set(), committed: new Set(), busy: new Set() };
    }

    const cutoff = new Date(Date.now() - CLAIM_LEASE_MS);
    const values = eventIds.map((eventId) => ({
      eventId,
      organizationId,
      projectId,
      signal,
    }));

    const claimedRows = await this.db
      .insert(ingestEventReceipts)
      .values(values)
      .onConflictDoUpdate({
        target: ingestEventReceipts.eventId,
        set: {
          status: "pending",
          attempts: sql`${ingestEventReceipts.attempts} + 1`,
          updatedAt: new Date(),
        },
        setWhere: and(
          eq(ingestEventReceipts.status, "pending"),
          lt(ingestEventReceipts.updatedAt, cutoff),
        ),
      })
      .returning({ eventId: ingestEventReceipts.eventId });

    const claimed = new Set(claimedRows.map((r) => r.eventId));
    const unresolved = eventIds.filter((id) => !claimed.has(id));

    const committed = new Set<string>();
    const busy = new Set<string>();
    if (unresolved.length === 0) {
      return { claimed, committed, busy };
    }

    const existing = await this.db
      .select({ eventId: ingestEventReceipts.eventId, status: ingestEventReceipts.status })
      .from(ingestEventReceipts)
      .where(inArray(ingestEventReceipts.eventId, unresolved));

    for (const row of existing) {
      if (row.status === "committed") {
        committed.add(row.eventId);
      } else {
        busy.add(row.eventId);
      }
    }

    for (const eventId of unresolved) {
      if (!committed.has(eventId) && !busy.has(eventId)) {
        busy.add(eventId);
      }
    }

    return { claimed, committed, busy };
  }

  async commit(eventId: string): Promise<void> {
    await this.db
      .update(ingestEventReceipts)
      .set({ status: "committed", committedAt: new Date() })
      .where(eq(ingestEventReceipts.eventId, eventId));
  }

  async commitBatch(eventIds: string[]): Promise<void> {
    await this.db
      .update(ingestEventReceipts)
      .set({ status: "committed", committedAt: new Date() })
      .where(inArray(ingestEventReceipts.eventId, eventIds));
  }

  async release(eventId: string): Promise<void> {
    await this.db
      .delete(ingestEventReceipts)
      .where(
        and(
          eq(ingestEventReceipts.eventId, eventId),
          eq(ingestEventReceipts.status, "pending"),
        ),
      );
  }

  async releaseBatch(eventIds: string[]): Promise<void> {
    await this.db
      .delete(ingestEventReceipts)
      .where(
        and(
          inArray(ingestEventReceipts.eventId, eventIds),
          eq(ingestEventReceipts.status, "pending"),
        ),
      );
  }
}
