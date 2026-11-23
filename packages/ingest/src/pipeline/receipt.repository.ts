import { Inject, Injectable, Optional } from "@nestjs/common";
import { DB, ingestEventReceipts, type Db } from "@soonwhy/shared";
import { and, eq, lt, sql, inArray } from "drizzle-orm";
import { ClaimLease } from "./claim-lease";
import type { ReceiptClaim } from "./receipt.repository.types";

export class ReceiptBusyError extends Error {
  constructor(eventId: string) {
    super(`Ingest receipt is leased by another worker: ${eventId}`);
  }
}

export class ReconcileUnavailableError extends ReceiptBusyError {
  constructor(indexId: string, detail: string) {
    super(indexId);
    this.message = `Quickwit lookup for "${indexId}" failed, deferring the batch: ${detail}`;
  }
}

const inOrganization = (organizationId: string) => eq(ingestEventReceipts.organizationId, organizationId);

@Injectable()
export class IngestReceiptRepository {
  private readonly lease: ClaimLease;

  constructor(@Inject(DB) private readonly db: Db, @Optional() lease?: ClaimLease) {
    this.lease = lease ?? new ClaimLease();
  }

  async claim(
    eventId: string,
    organizationId: string,
    projectId: string,
    signal: string,
  ): Promise<ReceiptClaim> {
    const cutoff = new Date(Date.now() - this.lease.ms);
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
    requestedEventIds: string[],
    organizationId: string,
    projectId: string,
    signal: string,
  ): Promise<{ claimed: Set<string>; reclaimed: Set<string>; committed: Set<string>; busy: Set<string> }> {
    if (requestedEventIds.length === 0) {
      return { claimed: new Set(), reclaimed: new Set(), committed: new Set(), busy: new Set() };
    }

    const eventIds = [...new Set(requestedEventIds)].sort();

    const cutoff = new Date(Date.now() - this.lease.ms);
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
      .returning({ eventId: ingestEventReceipts.eventId, attempts: ingestEventReceipts.attempts });

    const claimed = new Set(claimedRows.map((r) => r.eventId));
    const reclaimed = new Set(claimedRows.filter((r) => r.attempts > 1).map((r) => r.eventId));
    const unresolved = eventIds.filter((id) => !claimed.has(id));

    const committed = new Set<string>();
    const busy = new Set<string>();
    if (unresolved.length === 0) {
      return { claimed, reclaimed, committed, busy };
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

    return { claimed, reclaimed, committed, busy };
  }

  async commit(eventId: string, organizationId: string): Promise<void> {
    await this.db
      .update(ingestEventReceipts)
      .set({ status: "committed", committedAt: new Date() })
      .where(and(eq(ingestEventReceipts.eventId, eventId), inOrganization(organizationId)));
  }

  async commitBatch(eventIds: string[], organizationId: string): Promise<void> {
    await this.db
      .update(ingestEventReceipts)
      .set({ status: "committed", committedAt: new Date() })
      .where(and(inArray(ingestEventReceipts.eventId, eventIds), inOrganization(organizationId)));
  }

  async release(eventId: string, organizationId: string): Promise<void> {
    await this.db
      .delete(ingestEventReceipts)
      .where(
        and(
          eq(ingestEventReceipts.eventId, eventId),
          inOrganization(organizationId),
          eq(ingestEventReceipts.status, "pending"),
        ),
      );
  }

  async releaseBatch(eventIds: string[], organizationId: string): Promise<void> {
    await this.db
      .delete(ingestEventReceipts)
      .where(
        and(
          inArray(ingestEventReceipts.eventId, eventIds),
          inOrganization(organizationId),
          eq(ingestEventReceipts.status, "pending"),
        ),
      );
  }
}
