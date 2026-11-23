import { describe, expect, it, vi } from "vitest";
import { QUICKWIT_WRITE_STATE, QuickwitIngestError } from "@soonwhy/shared";
import { IngestConsumer } from "../src/pipeline/consumer";

const resource = {
  serviceName: "api",
  serviceVersion: "1.0.0",
  environment: "test",
  region: "local",
};

function logItem(message: string) {
  return {
    timestamp: new Date().toISOString(),
    message,
    severityNumber: 9,
    severityText: "INFO",
    severityLevel: "info",
    traceId: "",
    spanId: "",
    attributes: {},
    resource,
  };
}

function batch(messages: string[]) {
  return {
    version: 1,
    signal: "log",
    projectId: "proj_1",
    organizationId: "org_1",
    items: messages.map(logItem),
  };
}

type IngestStub = (indexId: string, documents: Array<Record<string, unknown>>) => Promise<unknown>;

const acceptAll: IngestStub = async (_indexId, documents) => ({
  received: documents.length,
  ingested: documents.length,
  rejected: [],
});

function makeConsumer(options?: {
  claim?: "claimed" | "committed" | "busy";
  ingest?: IngestStub;
  createDlqEntry?: () => Promise<unknown>;
}) {
  const quickwit = {
    ingest: vi.fn(options?.ingest ?? acceptAll),
    ensureIndex: vi.fn(),
    commitTimeoutSecs: vi.fn().mockResolvedValue(60),
    findEventIds: vi.fn().mockResolvedValue(new Set<string>()),
  };
  const receipts = {
    claim: vi.fn().mockResolvedValue(options?.claim ?? "claimed"),
    claimBatch: vi.fn().mockImplementation((eventIds: string[]) => {
      const committed =
        options?.claim === "committed" ? new Set(eventIds) : new Set<string>();
      const busy =
        options?.claim === "busy" ? new Set(eventIds) : new Set<string>();
      const claimed =
        options?.claim === "committed" || options?.claim === "busy"
          ? new Set<string>()
          : new Set(eventIds);
      return Promise.resolve({ claimed, reclaimed: new Set<string>(), committed, busy });
    }),
    commit: vi.fn().mockResolvedValue(undefined),
    commitBatch: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
    releaseBatch: vi.fn().mockResolvedValue(undefined),
  };
  const stats = {
    recordDuplicate: vi.fn(),
    recordInserted: vi.fn(),
    recordRejectedDocs: vi.fn(),
    recordDlq: vi.fn(),
    recordError: vi.fn(),
    startPeriodicLogging: vi.fn(),
  };
  const createDlqEntry = vi.fn(options?.createDlqEntry ?? (async () => undefined));
  const consumer = new IngestConsumer(
    { publish: vi.fn() } as never,
    quickwit as never,
    stats as never,
    { createDlqEntry } as never,
    receipts as never,
  );
  return { consumer, quickwit, receipts, stats, createDlqEntry };
}

function message(payload: unknown, subject = "ingest.proj_1.log") {
  return {
    subject,
    data: new TextEncoder().encode(JSON.stringify(payload)),
    info: { deliveryCount: 1 },
    ack: vi.fn(),
    nak: vi.fn(),
  };
}

function handle(
  consumer: IngestConsumer,
  signal: "log",
  msg: ReturnType<typeof message>,
): Promise<void> {
  return (
    consumer as unknown as {
      handleMessage(signal: string, msg: unknown): Promise<void>;
    }
  ).handleMessage(signal, msg);
}

describe("IngestConsumer batch handling", () => {
  it("writes every item in a batch and acks once", async () => {
    const { consumer, quickwit, receipts } = makeConsumer();
    const msg = message(batch(["one", "two"]));

    await handle(consumer, "log", msg);

    expect(quickwit.ingest).toHaveBeenCalledTimes(1);
    expect(receipts.claimBatch).toHaveBeenCalledTimes(1);
    expect(receipts.commitBatch).toHaveBeenCalledTimes(1);
    expect(msg.ack).toHaveBeenCalledOnce();
    expect(msg.nak).not.toHaveBeenCalled();
  });

  it("skips a committed duplicate without writing it", async () => {
    const { consumer, quickwit, stats } = makeConsumer({
      claim: "committed",
    });
    const msg = message(batch(["one"]));

    await handle(consumer, "log", msg);

    expect(quickwit.ingest).not.toHaveBeenCalled();
    expect(stats.recordDuplicate).toHaveBeenCalledWith(1);
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it("releases the receipts and naks when the write definitely did not happen", async () => {
    const { consumer, receipts } = makeConsumer({
      ingest: async () => {
        throw new QuickwitIngestError("connection refused", QUICKWIT_WRITE_STATE.notWritten);
      },
    });
    const msg = message(batch(["one"]));

    await handle(consumer, "log", msg);

    expect(receipts.releaseBatch).toHaveBeenCalledOnce();
    expect(msg.nak).toHaveBeenCalledOnce();
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it("leaves the receipts pending and naks when the outcome of the write is unknown", async () => {
    const { consumer, receipts, stats } = makeConsumer({
      ingest: async () => {
        throw new QuickwitIngestError("timed out", QUICKWIT_WRITE_STATE.unknown);
      },
    });
    const msg = message(batch(["one"]));

    await handle(consumer, "log", msg);

    expect(receipts.releaseBatch).not.toHaveBeenCalled();
    expect(receipts.commitBatch).not.toHaveBeenCalled();
    expect(msg.nak).toHaveBeenCalledOnce();
    expect(msg.ack).not.toHaveBeenCalled();
    expect(stats.recordInserted).not.toHaveBeenCalled();
  });

  it("treats an error that is not a classified Quickwit failure as unknown", async () => {
    const { consumer, receipts } = makeConsumer({
      ingest: async () => {
        throw new Error("something odd");
      },
    });

    await handle(consumer, "log", message(batch(["one"])));

    expect(receipts.releaseBatch).not.toHaveBeenCalled();
  });

  it("writes a repeated record once and claims each event id once", async () => {
    const { consumer, quickwit, receipts } = makeConsumer();
    const repeated = { ...batch(["same"]), items: [logItem("same"), logItem("same")] };
    repeated.items[1]!.timestamp = repeated.items[0]!.timestamp;
    const msg = message(repeated);

    await handle(consumer, "log", msg);

    const [ids] = receipts.claimBatch.mock.calls[0]!;
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(1);
    expect(quickwit.ingest.mock.calls[0]![1]).toHaveLength(1);
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it("acks a dead-letter message without treating it as telemetry", async () => {
    const { consumer, quickwit, receipts, stats } = makeConsumer();
    const msg = message({ signal: "log", reason: "boom", payload: "{}" }, "ingest.dlq.log");

    await handle(consumer, "log", msg);

    expect(msg.ack).toHaveBeenCalledOnce();
    expect(quickwit.ingest).not.toHaveBeenCalled();
    expect(receipts.claimBatch).not.toHaveBeenCalled();
    expect(stats.recordError).not.toHaveBeenCalled();
  });
});

function rejecting(...indexes: number[]): IngestStub {
  return async (_indexId, documents) => ({
    received: documents.length,
    ingested: documents.length - indexes.length,
    rejected: indexes.map((index) => ({
      document: JSON.stringify(documents[index]),
      reason: "invalid_schema",
      message: "field `timestamp` is required",
    })),
  });
}

describe("IngestConsumer rejected documents", () => {
  it("dead-letters a rejected document with its reason and commits the accepted ones", async () => {
    const { consumer, receipts, createDlqEntry, stats } = makeConsumer({ ingest: rejecting(1) });
    const msg = message(batch(["one", "two", "three"]));

    await handle(consumer, "log", msg);

    expect(createDlqEntry).toHaveBeenCalledOnce();
    const entry = createDlqEntry.mock.calls[0]![0] as { reason: string; payload: { message: string }; signal: string };
    expect(entry.reason).toMatch(/invalid_schema.*timestamp/);
    expect(entry.payload.message).toBe("two");
    expect(entry.signal).toBe("log");
    expect(receipts.commitBatch).toHaveBeenCalledTimes(2);
    expect(receipts.commitBatch.mock.calls[0]![0]).toHaveLength(2);
    expect(receipts.commitBatch.mock.calls[1]![0]).toHaveLength(1);
    expect(receipts.releaseBatch).not.toHaveBeenCalled();
    expect(stats.recordInserted).toHaveBeenCalledWith(2);
    expect(stats.recordRejectedDocs).toHaveBeenCalledWith(1);
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it("dead-letters every document when all are rejected and commits no accepted receipts", async () => {
    const { consumer, receipts, createDlqEntry } = makeConsumer({ ingest: rejecting(0, 1) });
    const msg = message(batch(["one", "two"]));

    await handle(consumer, "log", msg);

    expect(createDlqEntry).toHaveBeenCalledTimes(2);
    expect(receipts.commitBatch).toHaveBeenCalledTimes(2);
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it("keeps the message and the rejected receipt pending when the dead-letter row cannot be saved", async () => {
    const { consumer, receipts, stats } = makeConsumer({
      ingest: rejecting(1),
      createDlqEntry: async () => {
        throw new Error("db down");
      },
    });
    const msg = message(batch(["one", "two"]));

    await handle(consumer, "log", msg);

    expect(receipts.commitBatch).toHaveBeenCalledOnce();
    expect(receipts.commitBatch.mock.calls[0]![0]).toHaveLength(1);
    expect(stats.recordRejectedDocs).not.toHaveBeenCalled();
    expect(msg.nak).toHaveBeenCalledOnce();
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it("leaves receipts pending when the counts do not add up to the batch", async () => {
    const { consumer, receipts, createDlqEntry } = makeConsumer({
      ingest: async (_indexId, documents) => ({ received: documents.length, ingested: 1, rejected: [] }),
    });
    const msg = message(batch(["one", "two"]));

    await handle(consumer, "log", msg);

    expect(receipts.commitBatch).not.toHaveBeenCalled();
    expect(receipts.releaseBatch).not.toHaveBeenCalled();
    expect(createDlqEntry).not.toHaveBeenCalled();
    expect(msg.nak).toHaveBeenCalledOnce();
  });

  it("leaves receipts pending when a rejected document cannot be matched to a sent row", async () => {
    const { consumer, receipts, createDlqEntry } = makeConsumer({
      ingest: async (_indexId, documents) => ({
        received: documents.length,
        ingested: documents.length - 1,
        rejected: [{ document: "{}", reason: "unspecified", message: "" }],
      }),
    });
    const msg = message(batch(["one", "two"]));

    await handle(consumer, "log", msg);

    expect(receipts.commitBatch).not.toHaveBeenCalled();
    expect(createDlqEntry).not.toHaveBeenCalled();
    expect(msg.nak).toHaveBeenCalledOnce();
  });
});
