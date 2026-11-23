import { createDb, ingestEventReceipts, type Db } from "@soonwhy/shared";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "@soonwhy/test-support";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { CLAIM_LEASE_MS } from "../src/pipeline/constants";
import { IngestReceiptRepository } from "../src/pipeline/receipt.repository";

const ORG = "org_1";
const PROJECT = "proj_1";
const SIGNAL = "log";
const PARALLEL_CONSUMERS = 12;
const EXPIRED_BY_MS = CLAIM_LEASE_MS + 5_000;

describe.skipIf(!databaseTestsEnabled)("ingest receipts on a real database", () => {
  let db: Db;
  let receipts: IngestReceiptRepository;

  const claim = (eventId: string) => receipts.claim(eventId, ORG, PROJECT, SIGNAL);
  const commit = (eventId: string) => receipts.commit(eventId, ORG);
  const release = (eventId: string) => receipts.release(eventId, ORG);
  const commitBatch = (eventIds: string[]) => receipts.commitBatch(eventIds, ORG);
  const releaseBatch = (eventIds: string[]) => receipts.releaseBatch(eventIds, ORG);
  const claimBatch = (eventIds: string[]) => receipts.claimBatch(eventIds, ORG, PROJECT, SIGNAL);

  async function receiptOf(eventId: string) {
    const [row] = await db.select().from(ingestEventReceipts).where(eq(ingestEventReceipts.eventId, eventId));
    return row;
  }

  async function expireLease(eventId: string) {
    await db
      .update(ingestEventReceipts)
      .set({ updatedAt: sql`now() - make_interval(secs => ${EXPIRED_BY_MS / 1000})` })
      .where(eq(ingestEventReceipts.eventId, eventId));
  }

  beforeEach(async () => {
    await resetDatabase();
    db = createDb(process.env.DATABASE_URL!);
    receipts = new IngestReceiptRepository(db);
  });

  afterAll(closeDatabase);

  describe("single claim", () => {
    it("lets exactly one of many concurrent consumers claim an event", async () => {
      const outcomes = await Promise.all(Array.from({ length: PARALLEL_CONSUMERS }, () => claim("event-1")));

      expect(outcomes.filter((outcome) => outcome === "claimed")).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome === "busy")).toHaveLength(PARALLEL_CONSUMERS - 1);
      expect((await receiptOf("event-1"))?.attempts).toBe(1);
    });

    it("treats a committed receipt as a duplicate and does not touch it", async () => {
      await claim("event-1");
      await commit("event-1");
      const before = await receiptOf("event-1");

      expect(await claim("event-1")).toBe("committed");

      const after = await receiptOf("event-1");
      expect(after?.status).toBe("committed");
      expect(after?.attempts).toBe(before?.attempts);
      expect(after?.committedAt).toEqual(before?.committedAt);
    });

    it("keeps an unexpired pending claim busy", async () => {
      await claim("event-1");

      expect(await claim("event-1")).toBe("busy");
    });

    it("frees the event for a retry after a release", async () => {
      await claim("event-1");
      await release("event-1");

      expect(await claim("event-1")).toBe("claimed");
    });

    it("never releases a committed receipt", async () => {
      await claim("event-1");
      await commit("event-1");

      await release("event-1");

      expect(await claim("event-1")).toBe("committed");
    });

    it("lets an expired pending lease be re-claimed and counts the attempt", async () => {
      await claim("event-1");
      await expireLease("event-1");

      expect(await claim("event-1")).toBe("claimed");

      expect((await receiptOf("event-1"))?.attempts).toBe(2);
    });

    it("lets only one of many concurrent consumers take over an expired lease", async () => {
      await claim("event-1");
      await expireLease("event-1");

      const outcomes = await Promise.all(Array.from({ length: PARALLEL_CONSUMERS }, () => claim("event-1")));

      expect(outcomes.filter((outcome) => outcome === "claimed")).toHaveLength(1);
      expect((await receiptOf("event-1"))?.attempts).toBe(2);
    });
  });

  describe("batch claim", () => {
    it("reports which claimed ids were retried, so the caller can look them up before writing", async () => {
      await claimBatch(["retried"]);
      await expireLease("retried");

      const result = await claimBatch(["retried", "fresh"]);

      expect([...result.claimed].sort()).toEqual(["fresh", "retried"]);
      expect([...result.reclaimed]).toEqual(["retried"]);
    });

    it("does not report a released-then-claimed id as retried, because it was never written", async () => {
      await claimBatch(["a"]);
      await releaseBatch(["a"]);

      const result = await claimBatch(["a"]);

      expect(result.claimed.has("a")).toBe(true);
      expect(result.reclaimed.size).toBe(0);
    });

    it("claims every new id", async () => {
      const result = await claimBatch(["a", "b", "c"]);

      expect([...result.claimed].sort()).toEqual(["a", "b", "c"]);
      expect(result.committed.size).toBe(0);
      expect(result.busy.size).toBe(0);
    });

    it("sorts a mix of new, committed, busy and expired ids correctly", async () => {
      await claim("committed");
      await commit("committed");
      await claim("busy");
      await claim("expired");
      await expireLease("expired");

      const result = await claimBatch(["new", "committed", "busy", "expired"]);

      expect([...result.claimed].sort()).toEqual(["expired", "new"]);
      expect([...result.committed]).toEqual(["committed"]);
      expect([...result.busy]).toEqual(["busy"]);
      expect((await receiptOf("expired"))?.attempts).toBe(2);
      expect((await receiptOf("busy"))?.attempts).toBe(1);
    });

    it("gives each id to exactly one of many concurrent consumers", async () => {
      const ids = Array.from({ length: 40 }, (_, i) => `event-${i}`);

      const results = await Promise.all(Array.from({ length: PARALLEL_CONSUMERS }, () => claimBatch(ids)));

      const winners = new Map<string, number>();
      for (const result of results) for (const id of result.claimed) winners.set(id, (winners.get(id) ?? 0) + 1);
      expect(winners.size).toBe(ids.length);
      expect([...winners.values()].every((count) => count === 1)).toBe(true);
      for (const result of results) {
        expect(result.claimed.size + result.busy.size + result.committed.size).toBe(ids.length);
      }
    });

    it("does not deadlock when concurrent consumers claim overlapping ids in opposite order", async () => {
      const ids = Array.from({ length: 60 }, (_, i) => `event-${i}`);

      for (let round = 0; round < 5; round++) {
        await resetDatabase();
        const results = await Promise.all(
          Array.from({ length: PARALLEL_CONSUMERS }, (_, i) => claimBatch(i % 2 === 0 ? ids : [...ids].reverse())),
        );
        const claimedTotal = results.reduce((sum, result) => sum + result.claimed.size, 0);
        expect(claimedTotal).toBe(ids.length);
      }
    });

    it("copes with the same id appearing twice in one batch", async () => {
      const result = await claimBatch(["a", "b", "a"]);

      expect([...result.claimed].sort()).toEqual(["a", "b"]);
      expect((await receiptOf("a"))?.attempts).toBe(1);
    });

    it("handles an empty batch", async () => {
      const result = await claimBatch([]);

      expect(result.claimed.size + result.committed.size + result.busy.size).toBe(0);
    });
  });

  describe("batch commit and release", () => {
    it("commits a batch so redeliveries become duplicates", async () => {
      await claimBatch(["a", "b"]);

      await commitBatch(["a", "b"]);

      const again = await claimBatch(["a", "b"]);
      expect([...again.committed].sort()).toEqual(["a", "b"]);
      expect(again.claimed.size).toBe(0);
    });

    it("releases only pending receipts of a batch", async () => {
      await claimBatch(["done", "failed"]);
      await commit("done");

      await releaseBatch(["done", "failed"]);

      expect((await receiptOf("done"))?.status).toBe("committed");
      expect(await receiptOf("failed")).toBeUndefined();
      expect((await claimBatch(["failed"])).claimed.has("failed")).toBe(true);
    });

    it("accepts empty lists", async () => {
      await expect(commitBatch([])).resolves.toBeUndefined();
      await expect(releaseBatch([])).resolves.toBeUndefined();
    });
  });
});
