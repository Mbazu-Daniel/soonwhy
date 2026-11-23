import { createDb, QUICKWIT_WRITE_STATE, QuickwitIngestError, deadLetterQueue, type Db } from "@soonwhy/shared";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "@soonwhy/test-support";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { IngestConsumer } from "../src/pipeline/consumer";
import { DlqRepository } from "../src/pipeline/dlq.repository";
import { IngestReceiptRepository } from "../src/pipeline/receipt.repository";
import { IngestStats } from "../src/pipeline/stats";
import { deliver, logMessage } from "./support/log-messages";

type IngestStub = (indexId: string, documents: Array<Record<string, unknown>>) => Promise<unknown>;

describe.skipIf(!databaseTestsEnabled)("ingest consumer against real receipts and a Quickwit stub", () => {
  let db: Db;
  let receipts: IngestReceiptRepository;
  let stats: IngestStats;

  function consumerWith(ingest: IngestStub) {
    const quickwit = { ingest: vi.fn(ingest), ensureIndex: vi.fn() };
    const consumer = new IngestConsumer(
      { publish: vi.fn() } as never,
      quickwit as never,
      stats,
      new DlqRepository(db),
      receipts,
    );
    return { consumer, quickwit };
  }

  const handle = deliver;

  const acceptAll: IngestStub = async (_index, documents) => ({ received: documents.length, ingested: documents.length, rejected: [] });

  async function receiptStatuses() {
    const rows = await db.query.ingestEventReceipts.findMany();
    return rows.map((row) => row.status).sort();
  }

  beforeEach(async () => {
    await resetDatabase();
    db = createDb(process.env.DATABASE_URL!);
    receipts = new IngestReceiptRepository(db);
    stats = new IngestStats();
  });

  afterAll(closeDatabase);

  it("commits receipts for accepted documents and makes a redelivery a duplicate", async () => {
    const { consumer, quickwit } = consumerWith(acceptAll);

    await handle(consumer, logMessage("one", "two"));
    const redelivery = logMessage("one", "two");
    await handle(consumer, redelivery);

    expect(await receiptStatuses()).toEqual(["committed", "committed"]);
    expect(quickwit.ingest).toHaveBeenCalledTimes(1);
    expect(redelivery.ack).toHaveBeenCalledOnce();
    expect(stats.snapshot().duplicates).toBe(2);
  });

  it("dead-letters a rejected document, commits every receipt, and counts the rejection", async () => {
    const rejectSecond: IngestStub = async (_index, documents) => ({
      received: 2,
      ingested: 1,
      rejected: [{ document: JSON.stringify(documents[1]), reason: "invalid_schema", message: "field `timestamp` is required" }],
    });
    const { consumer } = consumerWith(rejectSecond);
    const msg = logMessage("one", "two");

    await handle(consumer, msg);

    const entries = await db.select().from(deadLetterQueue);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.reason).toMatch(/invalid_schema.*timestamp/);
    expect(entries[0]!.signal).toBe("log");
    expect(entries[0]!.organizationId).toBe("org_1");
    expect((entries[0]!.payload as { message: string }).message).toBe("two");
    expect(await receiptStatuses()).toEqual(["committed", "committed"]);
    expect(stats.snapshot()).toMatchObject({ inserted: 1, rejectedDocs: 1 });
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it("leaves receipts pending after a timeout so the redelivery does not write blind", async () => {
    const timeout: IngestStub = async () => {
      throw new QuickwitIngestError("timed out", QUICKWIT_WRITE_STATE.unknown);
    };
    const { consumer, quickwit } = consumerWith(timeout);
    const first = logMessage("one", "two");

    await handle(consumer, first);
    const redelivery = logMessage("one", "two");
    await handle(consumer, redelivery);

    expect(await receiptStatuses()).toEqual(["pending", "pending"]);
    expect(first.nak).toHaveBeenCalledOnce();
    expect(quickwit.ingest).toHaveBeenCalledTimes(1);
    expect(redelivery.nak).toHaveBeenCalledOnce();
    expect(redelivery.ack).not.toHaveBeenCalled();
  });

  it("releases receipts after a refused connection so the retry writes the batch", async () => {
    let refuse = true;
    const flaky: IngestStub = async (_index, documents) => {
      if (refuse) throw new QuickwitIngestError("ECONNREFUSED", QUICKWIT_WRITE_STATE.notWritten);
      return { received: documents.length, ingested: documents.length, rejected: [] };
    };
    const { consumer, quickwit } = consumerWith(flaky);
    const first = logMessage("one", "two");

    await handle(consumer, first);
    expect(await receiptStatuses()).toEqual([]);
    refuse = false;
    const retry = logMessage("one", "two");
    await handle(consumer, retry);

    expect(first.nak).toHaveBeenCalledOnce();
    expect(quickwit.ingest).toHaveBeenCalledTimes(2);
    expect(await receiptStatuses()).toEqual(["committed", "committed"]);
    expect(retry.ack).toHaveBeenCalledOnce();
  });
});
