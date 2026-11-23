import { ConflictException, NotFoundException } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/common/db";
import { deadLetterQueue } from "../../src/common/db/schema";
import { DlqService } from "../../src/modules/v1/telemetry/dlq/application/dlq.service";
import { DLQ_REPLAY_STATUS } from "../../src/modules/v1/telemetry/dlq/domain/dlq.constants";
import { DlqRepository } from "../../src/modules/v1/telemetry/dlq/infrastructure/dlq.repository";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";

const ACTOR = "user_1";

type Status = (typeof DLQ_REPLAY_STATUS)[keyof typeof DLQ_REPLAY_STATUS];

async function insertEntry(status: Status = "pending", replayedDaysAgo?: number) {
  const [entry] = await db
    .insert(deadLetterQueue)
    .values({
      signal: "log",
      deliveryCount: 6,
      reason: "sink unavailable",
      payload: { resourceLogs: [] },
      organizationId: "org_1",
      projectId: "proj_1",
      replayStatus: status,
      replayedAt: replayedDaysAgo === undefined ? null : sql`now() - make_interval(days => ${replayedDaysAgo})`,
    })
    .returning();
  return entry!;
}

async function remainingIds() {
  const rows = await db.select({ id: deadLetterQueue.id }).from(deadLetterQueue);
  return rows.map((row) => row.id).sort((a, b) => a - b);
}

describe.skipIf(!databaseTestsEnabled)("DLQ retention, delete and bulk replay", () => {
  const repository = new DlqRepository();

  function serviceWith(publishWithAck: ReturnType<typeof vi.fn>) {
    return new DlqService(repository, { publishWithAck } as never);
  }

  beforeEach(resetDatabase);
  afterAll(closeDatabase);

  describe("cleanup", () => {
    it("deletes only old succeeded entries and reports how many", async () => {
      await insertEntry("succeeded", 30);
      const recentSucceeded = await insertEntry("succeeded", 1);
      const oldFailed = await insertEntry("failed", 30);
      const oldPending = await insertEntry("pending", 30);
      const oldReplaying = await insertEntry("replaying", 30);

      const result = await serviceWith(vi.fn()).cleanupOldEntries(7);

      expect(result).toEqual({ deleted: 1 });
      expect(await remainingIds()).toEqual(
        [recentSucceeded.id, oldFailed.id, oldPending.id, oldReplaying.id].sort((a, b) => a - b),
      );
    });

    it("uses the default of 7 days when none is given", async () => {
      await insertEntry("succeeded", 8);
      const sixDays = await insertEntry("succeeded", 6);

      await serviceWith(vi.fn()).cleanupOldEntries(undefined);

      expect(await remainingIds()).toEqual([sixDays.id]);
    });

    it.each([0, -1, 1.5, 366])("rejects %s days and deletes nothing", async (days) => {
      await insertEntry("succeeded", 400);

      await expect(serviceWith(vi.fn()).cleanupOldEntries(days)).rejects.toThrow(/daysOld/);

      expect(await remainingIds()).toHaveLength(1);
    });
  });

  describe("delete", () => {
    it.each(["pending", "failed", "succeeded"] as const)("deletes a %s entry", async (status) => {
      const entry = await insertEntry(status, status === "pending" ? undefined : 1);

      await serviceWith(vi.fn()).deleteDlqEntry(entry.id);

      expect(await remainingIds()).toEqual([]);
    });

    it("refuses to delete an entry that is being replayed", async () => {
      const entry = await insertEntry("replaying");

      await expect(serviceWith(vi.fn()).deleteDlqEntry(entry.id)).rejects.toThrow(ConflictException);

      expect(await remainingIds()).toEqual([entry.id]);
    });

    it("answers not found for an entry that does not exist", async () => {
      await expect(serviceWith(vi.fn()).deleteDlqEntry(999_999)).rejects.toThrow(NotFoundException);
    });

    it("bulk delete removes what it can and reports the replaying entries it refused", async () => {
      const pending = await insertEntry("pending");
      const failed = await insertEntry("failed", 1);
      const replaying = await insertEntry("replaying");

      const result = await serviceWith(vi.fn()).bulkDelete([pending.id, failed.id, replaying.id, replaying.id]);

      expect(result).toEqual({ deleted: 2, refused: [replaying.id] });
      expect(await remainingIds()).toEqual([replaying.id]);
    });
  });

  describe("bulk replay", () => {
    it("replays each distinct id once and returns one result per id", async () => {
      const first = await insertEntry();
      const second = await insertEntry();
      const publish = vi.fn().mockResolvedValue(true);

      const result = await serviceWith(publish).bulkReplay([first.id, second.id, first.id], ACTOR);

      expect(publish).toHaveBeenCalledTimes(2);
      expect(result.total).toBe(2);
      expect(result.results).toEqual([
        { id: first.id, status: "succeeded" },
        { id: second.id, status: "succeeded" },
      ]);
    });

    it("reports a failed id with its error without stopping the others", async () => {
      const bad = await insertEntry();
      const good = await insertEntry();
      const publish = vi.fn().mockImplementation(async (_subject: string, _data: Uint8Array, messageId: string) => {
        if (messageId === `dlq-replay:${bad.id}`) throw new Error("nats down");
        return true;
      });

      const result = await serviceWith(publish).bulkReplay([bad.id, good.id, 999_999], ACTOR);

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.results).toEqual([
        { id: bad.id, status: "failed", error: "nats down" },
        { id: good.id, status: "succeeded" },
        { id: 999_999, status: "failed", error: "DLQ entry not found" },
      ]);
    });

    it("runs at most five replays at once", async () => {
      const entries = await Promise.all(Array.from({ length: 12 }, () => insertEntry()));
      let running = 0;
      let peak = 0;
      const publish = vi.fn().mockImplementation(async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 20));
        running--;
        return true;
      });

      await serviceWith(publish).bulkReplay(entries.map((entry) => entry.id), ACTOR);

      expect(peak).toBeLessThanOrEqual(5);
      expect(peak).toBeGreaterThan(1);
      expect(await db.select().from(deadLetterQueue).where(eq(deadLetterQueue.replayStatus, "succeeded"))).toHaveLength(12);
    });

    it("rejects more than 100 distinct ids before touching anything", async () => {
      const publish = vi.fn();

      await expect(serviceWith(publish).bulkReplay(Array.from({ length: 101 }, (_, i) => i + 1), ACTOR)).rejects.toThrow(/At most 100/);

      expect(publish).not.toHaveBeenCalled();
    });
  });
});
