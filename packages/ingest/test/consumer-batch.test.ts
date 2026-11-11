import { describe, expect, it, vi } from "vitest";
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

function makeConsumer(options?: {
  claim?: "claimed" | "committed" | "busy";
  ingestFails?: boolean;
}) {
  const quickwit = {
    ingest: options?.ingestFails
      ? vi.fn().mockRejectedValue(new Error("quickwit down"))
      : vi.fn().mockResolvedValue(undefined),
    ensureIndex: vi.fn(),
  };
  const receipts = {
    claim: vi.fn().mockResolvedValue(options?.claim ?? "claimed"),
    claimBatch: vi.fn().mockImplementation((eventIds: string[]) => {
      const committed =
        options?.claim === "committed" ? new Set(eventIds) : new Set<string>();
      const busy =
        options?.claim === "busy" ? new Set(eventIds) : new Set<string>();
      return Promise.resolve({ committed, busy });
    }),
    commit: vi.fn().mockResolvedValue(undefined),
    commitBatch: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
    releaseBatch: vi.fn().mockResolvedValue(undefined),
  };
  const stats = {
    recordDuplicate: vi.fn(),
    recordInserted: vi.fn(),
    recordDlq: vi.fn(),
    recordError: vi.fn(),
    startPeriodicLogging: vi.fn(),
  };
  const consumer = new IngestConsumer(
    { publish: vi.fn() } as never,
    quickwit as never,
    stats as never,
    { createDlqEntry: vi.fn() } as never,
    receipts as never,
  );
  return { consumer, quickwit, receipts, stats };
}

function message(payload: unknown) {
  return {
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

  it("releases the receipt and naks when the store rejects the write", async () => {
    const { consumer, receipts } = makeConsumer({ ingestFails: true });
    const msg = message(batch(["one"]));

    await handle(consumer, "log", msg);

    expect(receipts.releaseBatch).toHaveBeenCalledOnce();
    expect(msg.nak).toHaveBeenCalledOnce();
    expect(msg.ack).not.toHaveBeenCalled();
  });
});
