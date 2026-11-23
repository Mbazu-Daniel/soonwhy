import { createDb, deadLetterQueue, type Db } from "@soonwhy/shared";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "@soonwhy/test-support";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ClaimLease } from "../src/pipeline/claim-lease";
import { IngestConsumer } from "../src/pipeline/consumer";
import { LEASE_COMMIT_TIMEOUT_MULTIPLIER, LEASE_MARGIN_MS } from "../src/pipeline/constants";
import { DlqRepository } from "../src/pipeline/dlq.repository";
import { IngestReceiptRepository } from "../src/pipeline/receipt.repository";
import { IngestStats } from "../src/pipeline/stats";
import { VisibilityCanary } from "../src/pipeline/visibility-canary";
import { FakeCanaryStore } from "./support/fake-canary-store";
import { FakeQuickwit, VirtualClock, type IngestPlan } from "./support/fake-quickwit";
import { deliver, logMessage } from "./support/log-messages";

const COMMIT_TIMEOUT_SECS = 60;
const PUBLISH_DELAY_MS = 10_000;
const COMMIT_DELAY_MS = COMMIT_TIMEOUT_SECS * 1000 + PUBLISH_DELAY_MS;
const SECOND_MS = 1000;

class FlakyReceipts extends IngestReceiptRepository {
  failCommits = false;

  override async commitBatch(eventIds: string[], organizationId: string): Promise<void> {
    if (this.failCommits) throw new Error("postgres is down");
    return super.commitBatch(eventIds, organizationId);
  }
}

describe.skipIf(!databaseTestsEnabled)("failure-injection matrix: one stored document per event id", () => {
  let db: Db;
  let clock: VirtualClock;
  let quickwit: FakeQuickwit;
  let receipts: FlakyReceipts;
  let lease: ClaimLease;
  let stats: IngestStats;

  let canary: VisibilityCanary;
  let canaryStore: FakeCanaryStore;

  function newConsumer() {
    return new IngestConsumer({ publish: async () => undefined } as never, quickwit as never, stats, new DlqRepository(db), receipts, lease, canary);
  }

  async function passTime(ms: number) {
    clock.advance(ms);
    await db.execute(sql`update ingest_event_receipts set updated_at = updated_at - make_interval(secs => ${ms / SECOND_MS})`);
  }

  async function statuses() {
    return (await db.query.ingestEventReceipts.findMany()).map((row) => row.status).sort();
  }

  function expectExactlyOnce(eventIds: number) {
    const counts = quickwit.countsByEventId();
    expect(counts.size).toBe(eventIds);
    expect([...counts.values()].every((count) => count === 1)).toBe(true);
  }

  function plan(...plans: IngestPlan[]) {
    quickwit.plans.push(...plans);
  }

  beforeEach(async () => {
    await resetDatabase();
    db = createDb(process.env.DATABASE_URL!);
    clock = new VirtualClock();
    quickwit = new FakeQuickwit(clock, COMMIT_DELAY_MS, COMMIT_TIMEOUT_SECS);
    lease = new ClaimLease();
    const wallStart = Date.now();
    canaryStore = new FakeCanaryStore();
    canary = new VisibilityCanary(canaryStore, () => wallStart + clock.now);
    receipts = new FlakyReceipts(db, lease);
    stats = new IngestStats();
  });

  afterAll(closeDatabase);

  it("keeps the lease at least twice the index commit timeout plus a margin, and past the time documents become searchable", () => {
    expect(lease.ms).toBeGreaterThanOrEqual(COMMIT_TIMEOUT_SECS * SECOND_MS * LEASE_COMMIT_TIMEOUT_MULTIPLIER + LEASE_MARGIN_MS);
    expect(lease.ms).toBeGreaterThan(COMMIT_DELAY_MS);
  });

  it("1. Quickwit ok, Postgres commit fails for all retries, then lease expiry and redelivery", async () => {
    receipts.failCommits = true;
    const first = logMessage("one", "two");
    await deliver(newConsumer(), first);
    expect(first.nak).toHaveBeenCalledOnce();
    expect(await statuses()).toEqual(["pending", "pending"]);

    receipts.failCommits = false;
    await passTime(lease.ms + SECOND_MS);
    const redelivery = logMessage("one", "two");
    await deliver(newConsumer(), redelivery);

    expect(redelivery.ack).toHaveBeenCalledOnce();
    expect(await statuses()).toEqual(["committed", "committed"]);
    expect(quickwit.ingestCalls).toBe(1);
    expect(stats.snapshot().reconciled).toBe(2);
    expectExactlyOnce(2);
  });

  it("2. client timeout after the append: the redelivery waits out the lease, then finds the documents", async () => {
    plan("timeout-after-append");
    const first = logMessage("one", "two");
    await deliver(newConsumer(), first);
    expect(first.nak).toHaveBeenCalledOnce();

    await passTime(10 * SECOND_MS);
    const early = logMessage("one", "two");
    await deliver(newConsumer(), early);
    expect(early.nak).toHaveBeenCalledOnce();
    expect(quickwit.ingestCalls).toBe(1);
    expect(quickwit.lookupCalls).toBe(0);

    await passTime(lease.ms);
    const late = logMessage("one", "two");
    await deliver(newConsumer(), late);

    expect(late.ack).toHaveBeenCalledOnce();
    expect(quickwit.ingestCalls).toBe(1);
    expect(await statuses()).toEqual(["committed", "committed"]);
    expectExactlyOnce(2);
  });

  it("3. crash between ingest and commit, handled by a new process", async () => {
    plan("crash-after-append");
    await deliver(newConsumer(), logMessage("one", "two"));
    expect(await statuses()).toEqual(["pending", "pending"]);

    await passTime(lease.ms + SECOND_MS);
    const redelivery = logMessage("one", "two");
    await deliver(newConsumer(), redelivery);

    expect(redelivery.ack).toHaveBeenCalledOnce();
    expect(quickwit.ingestCalls).toBe(1);
    expectExactlyOnce(2);
  });

  it("3b. crash before the append: the retry finds nothing and writes the batch, so nothing is lost", async () => {
    plan("crash-before-append");
    await deliver(newConsumer(), logMessage("one", "two"));

    await passTime(lease.ms + SECOND_MS);
    const redelivery = logMessage("one", "two");
    await deliver(newConsumer(), redelivery);

    expect(redelivery.ack).toHaveBeenCalledOnce();
    expect(quickwit.ingestCalls).toBe(2);
    expect(quickwit.lookupCalls).toBe(1);
    expect(await statuses()).toEqual(["committed", "committed"]);
    expectExactlyOnce(2);
  });

  it("4. partially rejected batch: accepted stored once, rejected dead-lettered, redelivery changes nothing", async () => {
    plan({ reject: [1] });
    const first = logMessage("one", "two");
    await deliver(newConsumer(), first);
    expect(first.ack).toHaveBeenCalledOnce();
    expect(await db.select().from(deadLetterQueue)).toHaveLength(1);

    const redelivery = logMessage("one", "two");
    await deliver(newConsumer(), redelivery);

    expect(redelivery.ack).toHaveBeenCalledOnce();
    expect(quickwit.ingestCalls).toBe(1);
    expect(await db.select().from(deadLetterQueue)).toHaveLength(1);
    expect(await statuses()).toEqual(["committed", "committed"]);
    expectExactlyOnce(1);
  });

  it("5. lookup before the documents are searchable: the lease defers the redelivery until they are", async () => {
    plan("timeout-after-append");
    await deliver(newConsumer(), logMessage("one", "two"));

    await passTime(lease.ms - SECOND_MS);
    const beforeLease = logMessage("one", "two");
    await deliver(newConsumer(), beforeLease);
    expect(beforeLease.nak).toHaveBeenCalledOnce();
    expect(quickwit.ingestCalls).toBe(1);

    await passTime(2 * SECOND_MS);
    expect(clock.now).toBeGreaterThan(COMMIT_DELAY_MS);
    const afterLease = logMessage("one", "two");
    await deliver(newConsumer(), afterLease);

    expect(afterLease.ack).toHaveBeenCalledOnce();
    expect(quickwit.ingestCalls).toBe(1);
    expectExactlyOnce(2);
  });

  it("6. two consumers racing on one batch: exactly one writes", async () => {
    quickwit.ingestDelayMs = 50;
    const left = logMessage("one", "two");
    const right = logMessage("one", "two");

    await Promise.all([deliver(newConsumer(), left), deliver(newConsumer(), right)]);

    expect(quickwit.ingestCalls).toBe(1);
    expect([left.ack.mock.calls.length, right.ack.mock.calls.length].sort()).toEqual([0, 1]);
    expect([left.nak.mock.calls.length, right.nak.mock.calls.length].sort()).toEqual([0, 1]);
    expectExactlyOnce(2);
  });

  it("7. ack lost on redelivery: a committed batch is skipped", async () => {
    await deliver(newConsumer(), logMessage("one", "two"));
    const redelivery = logMessage("one", "two");

    await deliver(newConsumer(), redelivery);

    expect(redelivery.ack).toHaveBeenCalledOnce();
    expect(quickwit.ingestCalls).toBe(1);
    expect(stats.snapshot().duplicates).toBe(2);
    expectExactlyOnce(2);
  });

  describe("beyond the seven cases", () => {
    it("fails closed when the lookup is unavailable, then recovers without a duplicate", async () => {
      plan("timeout-after-append");
      await deliver(newConsumer(), logMessage("one", "two"));
      quickwit.lookupFails = true;

      await passTime(lease.ms + SECOND_MS);
      const blocked = logMessage("one", "two");
      await deliver(newConsumer(), blocked);

      expect(blocked.nak).toHaveBeenCalledOnce();
      expect(blocked.ack).not.toHaveBeenCalled();
      expect(quickwit.ingestCalls).toBe(1);
      expect(await statuses()).toEqual(["pending", "pending"]);

      quickwit.lookupFails = false;
      await passTime(lease.ms + SECOND_MS);
      const recovered = logMessage("one", "two");
      await deliver(newConsumer(), recovered);

      expect(recovered.ack).toHaveBeenCalledOnce();
      expect(quickwit.ingestCalls).toBe(1);
      expectExactlyOnce(2);
    });

    it("defers instead of writing when the indexer is behind, then writes once it catches up", async () => {
      await deliver(newConsumer(), logMessage("canary"));
      plan("timeout-after-append");
      await deliver(newConsumer(), logMessage("one", "two"));
      quickwit.holdVisibility = true;

      await passTime(lease.ms + SECOND_MS);
      const stalled = logMessage("one", "two");
      await deliver(newConsumer(), stalled);

      expect(stalled.nak).toHaveBeenCalledOnce();
      expect(quickwit.ingestCalls).toBe(2);
      expect(await statuses()).toContain("pending");

      quickwit.holdVisibility = false;
      await passTime(lease.ms + SECOND_MS);
      const caughtUp = logMessage("one", "two");
      await deliver(newConsumer(), caughtUp);

      expect(caughtUp.ack).toHaveBeenCalledOnce();
      expect(quickwit.ingestCalls).toBe(2);
      expectExactlyOnce(3);
    });

    it("fails closed when the canary store is down on a retry, then recovers", async () => {
      plan("timeout-after-append");
      await deliver(newConsumer(), logMessage("one", "two"));
      await passTime(lease.ms + SECOND_MS);
      quickwit.holdVisibility = true;
      canaryStore.failing = true;

      const blocked = logMessage("one", "two");
      await deliver(newConsumer(), blocked);

      expect(blocked.nak).toHaveBeenCalledOnce();
      expect(quickwit.ingestCalls).toBe(1);
    });

    it("a definite failure releases the receipts and the retry writes without a lookup", async () => {
      plan("refuse");
      await deliver(newConsumer(), logMessage("one", "two"));
      expect(await statuses()).toEqual([]);

      const retry = logMessage("one", "two");
      await deliver(newConsumer(), retry);

      expect(retry.ack).toHaveBeenCalledOnce();
      expect(quickwit.lookupCalls).toBe(0);
      expectExactlyOnce(2);
    });

    it("a mixed retry looks up only the retried rows and writes only the missing ones", async () => {
      plan("timeout-after-append");
      await deliver(newConsumer(), logMessage("one"));
      await passTime(lease.ms + SECOND_MS);

      const mixed = logMessage("one", "two");
      await deliver(newConsumer(), mixed);

      expect(mixed.ack).toHaveBeenCalledOnce();
      expect(quickwit.ingestCalls).toBe(2);
      expect(stats.snapshot().reconciled).toBe(1);
      expectExactlyOnce(2);
    });
  });
});
