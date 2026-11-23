import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/common/db";
import { deadLetterQueue, deadLetterQueueAttempts } from "../../src/common/db/schema";
import { DlqService } from "../../src/modules/v1/telemetry/dlq/application/dlq.service";
import { MAX_REPLAY_ATTEMPTS } from "../../src/modules/v1/telemetry/dlq/domain/dlq.constants";
import { DlqRepository } from "../../src/modules/v1/telemetry/dlq/infrastructure/dlq.repository";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";

async function insertEntry() {
  const [entry] = await db
    .insert(deadLetterQueue)
    .values({
      signal: "log",
      deliveryCount: 6,
      reason: "sink unavailable",
      payload: { resourceLogs: [] },
      organizationId: "org_1",
      projectId: "proj_1",
    })
    .returning();
  return entry!;
}

describe.skipIf(!databaseTestsEnabled)("DLQ replay attempts", () => {
  const repository = new DlqRepository();

  function serviceWith(publishWithAck: ReturnType<typeof vi.fn>) {
    return new DlqService(repository, { publishWithAck } as never);
  }

  async function failTimes(service: DlqService, id: number, times: number) {
    for (let i = 0; i < times; i++) {
      await expect(service.replayDlqEntry(id, "user_1")).rejects.toThrow("down");
    }
  }

  beforeEach(resetDatabase);
  afterAll(closeDatabase);

  it("records a successful attempt with who triggered it and when", async () => {
    const entry = await insertEntry();

    await serviceWith(vi.fn().mockResolvedValue(true)).replayDlqEntry(entry.id, "user_a");

    const [attempt] = await repository.getAttempts(entry.id);
    expect(attempt).toMatchObject({
      entryId: entry.id,
      attemptNumber: 1,
      triggeredBy: "user_a",
      outcome: "succeeded",
      error: null,
      forced: false,
    });
    expect(attempt!.finishedAt).not.toBeNull();
    expect(attempt!.finishedAt!.getTime()).toBeGreaterThanOrEqual(attempt!.startedAt.getTime());
  });

  it("records a failed attempt with its error, and each retry as its own row", async () => {
    const entry = await insertEntry();
    const service = serviceWith(vi.fn().mockRejectedValueOnce(new Error("nats down")).mockResolvedValueOnce(true));

    await expect(service.replayDlqEntry(entry.id, "user_a")).rejects.toThrow("nats down");
    await service.replayDlqEntry(entry.id, "user_b");

    const attempts = await repository.getAttempts(entry.id);
    expect(attempts.map((a) => [a.attemptNumber, a.triggeredBy, a.outcome, a.error])).toEqual([
      [2, "user_b", "succeeded", null],
      [1, "user_a", "failed", "nats down"],
    ]);
  });

  it("marks a crashed attempt as abandoned when its lease is taken over", async () => {
    const entry = await insertEntry();
    await repository.claimReplay(entry.id, "user_a");
    await db.update(deadLetterQueue).set({ replayLeaseExpiresAt: sql`now() - interval '1 second'` });

    await repository.claimReplay(entry.id, "user_b");

    const attempts = await repository.getAttempts(entry.id);
    expect(attempts.map((a) => [a.attemptNumber, a.outcome])).toEqual([[2, "started"], [1, "abandoned"]]);
  });

  it("refuses the sixth attempt without force and keeps the entry untouched", async () => {
    const entry = await insertEntry();
    const publish = vi.fn().mockRejectedValue(new Error("down"));
    const service = serviceWith(publish);
    await failTimes(service, entry.id, MAX_REPLAY_ATTEMPTS);

    await expect(service.replayDlqEntry(entry.id, "user_1")).rejects.toThrow(/attempt limit \(5\) reached/);

    expect(publish).toHaveBeenCalledTimes(MAX_REPLAY_ATTEMPTS);
    expect(await repository.getAttempts(entry.id)).toHaveLength(MAX_REPLAY_ATTEMPTS);
  });

  it("allows the sixth attempt with force and records that it was forced", async () => {
    const entry = await insertEntry();
    const publish = vi.fn().mockRejectedValue(new Error("down"));
    const service = serviceWith(publish);
    await failTimes(service, entry.id, MAX_REPLAY_ATTEMPTS);
    publish.mockResolvedValue(true);

    await service.replayDlqEntry(entry.id, "super_admin", true);

    const [latest] = await repository.getAttempts(entry.id);
    expect(latest).toMatchObject({ attemptNumber: 6, triggeredBy: "super_admin", forced: true, outcome: "succeeded" });
    const [row] = await db.select().from(deadLetterQueue).where(eq(deadLetterQueue.id, entry.id));
    expect(row!.replayStatus).toBe("succeeded");
  });

  it("does not count force against attempts below the limit", async () => {
    const entry = await insertEntry();

    await serviceWith(vi.fn().mockResolvedValue(true)).replayDlqEntry(entry.id, "user_1", true);

    const [attempt] = await repository.getAttempts(entry.id);
    expect(attempt!.forced).toBe(false);
  });

  it("keeps the attempt history after the entry is deleted", async () => {
    const entry = await insertEntry();
    await serviceWith(vi.fn().mockResolvedValue(true)).replayDlqEntry(entry.id, "user_1");

    await db.delete(deadLetterQueue).where(eq(deadLetterQueue.id, entry.id));

    expect(await repository.getAttempts(entry.id)).toHaveLength(1);
  });

  describe("append-only guarantee", () => {
    it("rejects deleting an attempt", async () => {
      const entry = await insertEntry();
      await repository.claimReplay(entry.id, "user_1");

      await expect(db.delete(deadLetterQueueAttempts)).rejects.toThrow();
    });

    it("rejects changing a completed attempt", async () => {
      const entry = await insertEntry();
      const claimed = await repository.claimReplay(entry.id, "user_1");
      await repository.finalizeReplay(entry.id, claimed!.replayAttempts!, true);

      await expect(db.update(deadLetterQueueAttempts).set({ outcome: "failed" })).rejects.toThrow();
    });

    it("rejects rewriting who triggered an attempt", async () => {
      const entry = await insertEntry();
      await repository.claimReplay(entry.id, "user_1");

      await expect(db.update(deadLetterQueueAttempts).set({ triggeredBy: "someone_else" })).rejects.toThrow();
    });
  });
});
