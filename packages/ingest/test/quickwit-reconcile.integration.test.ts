import { createDb, QUICKWIT_INDEX_CONFIG, QUICKWIT_INDEXES, QUICKWIT_WRITE_STATE, QuickwitIngestError, QuickwitService, type Db } from "@soonwhy/shared";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "@soonwhy/test-support";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ClaimLease } from "../src/pipeline/claim-lease";
import { IngestConsumer } from "../src/pipeline/consumer";
import { DlqRepository } from "../src/pipeline/dlq.repository";
import { IngestReceiptRepository } from "../src/pipeline/receipt.repository";
import { IngestStats } from "../src/pipeline/stats";
import { deliver, logMessage } from "./support/log-messages";

const quickwitUrl = process.env.QUICKWIT_TEST_URL;
const COMMIT_TIMEOUT_SECS = 2;
const VISIBLE_WITHIN_MS = 60_000;
const POLL_MS = 500;
const SECOND_MS = 1000;

describe.skipIf(!databaseTestsEnabled || !quickwitUrl)("reconcile-before-rewrite against a real Quickwit", () => {
  let db: Db;
  let quickwit: QuickwitService;
  let receipts: IngestReceiptRepository;
  let lease: ClaimLease;
  let stats: IngestStats;

  class TimeoutAfterAppend extends QuickwitService {
    armed = true;

    override async ingest(indexId: string, documents: Record<string, unknown>[]) {
      const result = await super.ingest(indexId, documents);
      if (!this.armed) return result;
      this.armed = false;
      throw new QuickwitIngestError("timed out after the append", QUICKWIT_WRITE_STATE.unknown);
    }
  }

  async function documentCount(): Promise<number> {
    const response = await quickwit.search<unknown>(QUICKWIT_INDEXES.logs, { query: "*", maxHits: 0 });
    return response.num_hits;
  }

  async function waitUntilSearchable(expected: number): Promise<void> {
    const deadline = Date.now() + VISIBLE_WITHIN_MS;
    while (Date.now() < deadline) {
      if ((await documentCount()) >= expected) return;
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    throw new Error(`Documents did not become searchable within ${VISIBLE_WITHIN_MS}ms`);
  }

  async function waitUntilIdsSearchable(ids: string[]): Promise<void> {
    const deadline = Date.now() + VISIBLE_WITHIN_MS;
    while (Date.now() < deadline) {
      if ((await quickwit.findEventIds(QUICKWIT_INDEXES.logs, ids)).size === ids.length) return;
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    throw new Error("Documents did not become searchable in time");
  }

  beforeAll(async () => {
    process.env.QUICKWIT_URL = quickwitUrl;
    quickwit = new TimeoutAfterAppend();
    await quickwit.ensureIndex(QUICKWIT_INDEXES.logs, JSON.parse(JSON.stringify({ ...QUICKWIT_INDEX_CONFIG, indexing_settings: { commit_timeout_secs: COMMIT_TIMEOUT_SECS } })));
  });

  beforeEach(async () => {
    await resetDatabase();
    db = createDb(process.env.DATABASE_URL!);
    lease = new ClaimLease();
    lease.configure([await quickwit.commitTimeoutSecs(QUICKWIT_INDEXES.logs)]);
    receipts = new IngestReceiptRepository(db, lease);
    stats = new IngestStats();
    (quickwit as TimeoutAfterAppend).armed = true;
  });

  afterAll(closeDatabase);

  it("stores each document once when the first write timed out after the append", async () => {
    const before = await documentCount();
    const consumer = () => new IngestConsumer({ publish: async () => undefined } as never, quickwit, stats, new DlqRepository(db), receipts, lease);
    const first = logMessage("real-one", "real-two");

    await deliver(consumer(), first);
    expect(first.nak).toHaveBeenCalledOnce();
    await waitUntilSearchable(before + 2);

    await db.execute(sql`update ingest_event_receipts set updated_at = updated_at - make_interval(secs => ${lease.ms / SECOND_MS + 1})`);
    const redelivery = logMessage("real-one", "real-two");
    await deliver(consumer(), redelivery);

    expect(redelivery.ack).toHaveBeenCalledOnce();
    expect(stats.snapshot().reconciled).toBe(2);
    await new Promise((resolve) => setTimeout(resolve, (COMMIT_TIMEOUT_SECS + 3) * SECOND_MS));
    expect(await documentCount()).toBe(before + 2);
    expect((await db.query.ingestEventReceipts.findMany()).map((row) => row.status)).toEqual(["committed", "committed"]);
  });

  it("measures real duplicates in the index and ignores unique documents", async () => {
    (quickwit as TimeoutAfterAppend).armed = false;
    const stamp = Date.now();
    const timestamp = new Date().toISOString();
    const duplicated = `dup-${stamp}`;
    const unique = `uniq-${stamp}`;
    const doc = (eventId: string) => ({ eventId, timestamp, message: "m", severityNumber: 9, severityText: "INFO", severityLevel: "info" });
    await quickwit.ingest(QUICKWIT_INDEXES.logs, [doc(duplicated), doc(unique)]);
    await quickwit.ingest(QUICKWIT_INDEXES.logs, [doc(duplicated)]);
    const before = await documentCount();
    await waitUntilSearchable(before + 1);
    await waitUntilIdsSearchable([duplicated, unique]);

    const seconds = Math.floor(stamp / SECOND_MS);
    const report = await quickwit.duplicateReport(QUICKWIT_INDEXES.logs, { startTimestamp: seconds - 60, endTimestamp: seconds + 60 });

    expect(report.duplicateEventIds).toBeGreaterThanOrEqual(1);
    expect(report.extraCopies).toBeGreaterThanOrEqual(1);
    const found = await quickwit.findEventIds(QUICKWIT_INDEXES.logs, [duplicated, unique]);
    expect([...found].sort()).toEqual([duplicated, unique].sort());
  });
});
