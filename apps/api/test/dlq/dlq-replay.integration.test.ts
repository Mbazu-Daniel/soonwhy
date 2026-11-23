import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/common/db";
import { deadLetterQueue } from "../../src/common/db/schema";
import { DlqService } from "../../src/modules/v1/telemetry/dlq/application/dlq.service";
import { ALL_ORGANIZATIONS } from "../../src/modules/v1/telemetry/dlq/domain/dlq.scope";
import { DLQ_REPLAY_STATUS } from "../../src/modules/v1/telemetry/dlq/domain/dlq.constants";
import { DlqRepository } from "../../src/modules/v1/telemetry/dlq/infrastructure/dlq.repository";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";

const PARALLEL_CLAIMS = 12;
const ACTOR = "user_1";

async function insertEntry(overrides: Partial<typeof deadLetterQueue.$inferInsert> = {}) {
  const [entry] = await db
    .insert(deadLetterQueue)
    .values({
      signal: "log",
      deliveryCount: 6,
      reason: "sink unavailable",
      payload: { resourceLogs: [] },
      organizationId: "org_1",
      projectId: "proj_1",
      ...overrides,
    })
    .returning();
  return entry!;
}

async function expireLease(id: number) {
  await db
    .update(deadLetterQueue)
    .set({ replayLeaseExpiresAt: sql`now() - interval '1 second'` })
    .where(eq(deadLetterQueue.id, id));
}

async function load(id: number) {
  const [row] = await db.select().from(deadLetterQueue).where(eq(deadLetterQueue.id, id));
  return row!;
}

describe.skipIf(!databaseTestsEnabled)("DLQ replay state machine", () => {
  const repository = new DlqRepository();

  beforeEach(resetDatabase);
  afterAll(closeDatabase);

  describe("claim", () => {
    it("lets exactly one of many parallel claims win", async () => {
      const entry = await insertEntry();

      const results = await Promise.all(
        Array.from({ length: PARALLEL_CLAIMS }, () => repository.claimReplay(entry.id, ACTOR, false, ALL_ORGANIZATIONS)),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
      const row = await load(entry.id);
      expect(row.replayStatus).toBe(DLQ_REPLAY_STATUS.replaying);
      expect(row.replayAttempts).toBe(1);
      expect(row.replayLeaseExpiresAt).not.toBeNull();
    });

    it("refuses a second claim while the lease is still held", async () => {
      const entry = await insertEntry();
      await repository.claimReplay(entry.id, ACTOR, false, ALL_ORGANIZATIONS);

      expect(await repository.claimReplay(entry.id, ACTOR, false, ALL_ORGANIZATIONS)).toBeUndefined();
    });

    it("lets a crashed claim be taken over once its lease has expired", async () => {
      const entry = await insertEntry();
      await repository.claimReplay(entry.id, ACTOR, false, ALL_ORGANIZATIONS);
      await expireLease(entry.id);

      const reclaimed = await repository.claimReplay(entry.id, ACTOR, false, ALL_ORGANIZATIONS);

      expect(reclaimed?.replayAttempts).toBe(2);
    });

    it("allows a failed entry to be claimed again", async () => {
      const entry = await insertEntry();
      const first = await repository.claimReplay(entry.id, ACTOR, false, ALL_ORGANIZATIONS);
      await repository.finalizeReplay(entry.id, first!.replayAttempts!, false, "boom");

      const second = await repository.claimReplay(entry.id, ACTOR, false, ALL_ORGANIZATIONS);

      expect(second?.replayAttempts).toBe(2);
    });

    it("never claims an entry that already succeeded", async () => {
      const entry = await insertEntry();
      const claimed = await repository.claimReplay(entry.id, ACTOR, false, ALL_ORGANIZATIONS);
      await repository.finalizeReplay(entry.id, claimed!.replayAttempts!, true);

      expect(await repository.claimReplay(entry.id, ACTOR, false, ALL_ORGANIZATIONS)).toBeUndefined();
    });
  });

  describe("finalize", () => {
    it("rejects a stale worker whose claim was taken over", async () => {
      const entry = await insertEntry();
      const stale = await repository.claimReplay(entry.id, ACTOR, false, ALL_ORGANIZATIONS);
      await expireLease(entry.id);
      const current = await repository.claimReplay(entry.id, ACTOR, false, ALL_ORGANIZATIONS);

      const staleResult = await repository.finalizeReplay(entry.id, stale!.replayAttempts!, true);

      expect(staleResult).toBeUndefined();
      expect((await load(entry.id)).replayStatus).toBe(DLQ_REPLAY_STATUS.replaying);

      const currentResult = await repository.finalizeReplay(entry.id, current!.replayAttempts!, true);
      expect(currentResult?.replayStatus).toBe(DLQ_REPLAY_STATUS.succeeded);
    });

    it("records the error of a failed replay and clears the lease", async () => {
      const entry = await insertEntry();
      const claimed = await repository.claimReplay(entry.id, ACTOR, false, ALL_ORGANIZATIONS);

      await repository.finalizeReplay(entry.id, claimed!.replayAttempts!, false, "publish timed out");

      const row = await load(entry.id);
      expect(row.replayStatus).toBe(DLQ_REPLAY_STATUS.failed);
      expect(row.replayError).toBe("publish timed out");
      expect(row.replayLeaseExpiresAt).toBeNull();
    });

    it("cannot finalize an entry that was never claimed", async () => {
      const entry = await insertEntry();

      expect(await repository.finalizeReplay(entry.id, 1, true)).toBeUndefined();
    });
  });

  describe("service", () => {
    function serviceWith(publishWithAck: ReturnType<typeof vi.fn>) {
      return new DlqService(repository, { publishWithAck } as never);
    }

    it("publishes with a message id derived from the entry and marks it succeeded", async () => {
      const entry = await insertEntry();
      const publish = vi.fn().mockResolvedValue(true);

      const result = await serviceWith(publish).replayDlqEntry(entry.id, ACTOR);

      expect(result).toEqual({ success: true, subject: "ingest.proj_1.log" });
      expect(publish).toHaveBeenCalledWith("ingest.proj_1.log", expect.any(Uint8Array), `dlq-replay:${entry.id}`);
      expect((await load(entry.id)).replayStatus).toBe(DLQ_REPLAY_STATUS.succeeded);
    });

    it("keeps the entry replayable when the publish is not acknowledged", async () => {
      const entry = await insertEntry();

      await expect(serviceWith(vi.fn().mockResolvedValue(false)).replayDlqEntry(entry.id, ACTOR)).rejects.toThrow(
        /did not acknowledge/,
      );

      const row = await load(entry.id);
      expect(row.replayStatus).toBe(DLQ_REPLAY_STATUS.failed);
      expect(row.replayError).toMatch(/did not acknowledge/);
    });

    it("keeps the entry replayable when the publish throws, and a retry succeeds", async () => {
      const entry = await insertEntry();
      const publish = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(true);
      const service = serviceWith(publish);

      await expect(service.replayDlqEntry(entry.id, ACTOR)).rejects.toThrow("timeout");
      await service.replayDlqEntry(entry.id, ACTOR);

      const row = await load(entry.id);
      expect(row.replayStatus).toBe(DLQ_REPLAY_STATUS.succeeded);
      expect(row.replayAttempts).toBe(2);
      expect(publish.mock.calls.map((call) => call[2])).toEqual([`dlq-replay:${entry.id}`, `dlq-replay:${entry.id}`]);
    });

    it("publishes once when the same entry is replayed concurrently", async () => {
      const entry = await insertEntry();
      const publish = vi.fn().mockResolvedValue(true);
      const service = serviceWith(publish);

      const outcomes = await Promise.allSettled(
        Array.from({ length: PARALLEL_CLAIMS }, () => service.replayDlqEntry(entry.id, ACTOR)),
      );

      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(publish).toHaveBeenCalledTimes(1);
    });
  });

  describe("stats and retention", () => {
    it("counts each state separately", async () => {
      const pending = await insertEntry();
      const replaying = await insertEntry();
      const failed = await insertEntry();
      const succeeded = await insertEntry();
      await repository.claimReplay(replaying.id, ACTOR, false, ALL_ORGANIZATIONS);
      const failedClaim = await repository.claimReplay(failed.id, ACTOR, false, ALL_ORGANIZATIONS);
      await repository.finalizeReplay(failed.id, failedClaim!.replayAttempts!, false, "boom");
      const succeededClaim = await repository.claimReplay(succeeded.id, ACTOR, false, ALL_ORGANIZATIONS);
      await repository.finalizeReplay(succeeded.id, succeededClaim!.replayAttempts!, true);

      const stats = await repository.getDlqStats(ALL_ORGANIZATIONS);

      expect(pending.id).toBeDefined();
      expect(Number(stats!.total)).toBe(4);
      expect(Number(stats!.unreplayed)).toBe(1);
      expect(Number(stats!.replaying)).toBe(1);
      expect(Number(stats!.failed)).toBe(1);
      expect(Number(stats!.successful)).toBe(1);
    });

    it("cleanup removes old succeeded entries but never failed ones", async () => {
      const succeeded = await insertEntry();
      const failed = await insertEntry();
      const succeededClaim = await repository.claimReplay(succeeded.id, ACTOR, false, ALL_ORGANIZATIONS);
      await repository.finalizeReplay(succeeded.id, succeededClaim!.replayAttempts!, true);
      const failedClaim = await repository.claimReplay(failed.id, ACTOR, false, ALL_ORGANIZATIONS);
      await repository.finalizeReplay(failed.id, failedClaim!.replayAttempts!, false, "boom");
      await db.update(deadLetterQueue).set({ replayedAt: sql`now() - interval '30 days'` });

      await repository.deleteSucceededEntries(7);

      const remaining = await db.select({ id: deadLetterQueue.id }).from(deadLetterQueue);
      expect(remaining.map((row) => row.id)).toEqual([failed.id]);
    });
  });

  describe("schema", () => {
    it("rejects a replay status outside the allowed set", async () => {
      await expect(insertEntry({ replayStatus: "done" })).rejects.toThrow();
    });
  });
});
