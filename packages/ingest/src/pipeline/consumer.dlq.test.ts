import { describe, expect, it, vi } from "vitest";
import { IngestConsumer } from "./consumer";
import { CLAIM_LEASE_MS, MAX_DELIVERY_ATTEMPTS } from "./constants";

function build(createDlqEntry: () => Promise<void>) {
  const receipts = { claimBatch: vi.fn(async () => { throw new Error("db down"); }) };
  const nats = { publish: vi.fn(async () => undefined) };
  const consumer = new IngestConsumer(
    nats as never,
    {} as never,
    { recordError: vi.fn(), recordDlq: vi.fn() } as never,
    { createDlqEntry } as never,
    receipts as never,
  );
  const msg = {
    subject: "ingest.org.trace",
    data: new TextEncoder().encode("{not json"),
    info: { deliveryCount: MAX_DELIVERY_ATTEMPTS },
    ack: vi.fn(),
    nak: vi.fn(),
  };
  return { consumer, msg };
}

describe("ingest dead-letter handling", () => {
  it("keeps the message when the dead-letter row cannot be written", async () => {
    const { consumer, msg } = build(async () => { throw new Error("db down"); });
    await (consumer as never as { handleMessage(s: string, m: unknown): Promise<void> }).handleMessage("trace", msg);
    expect(msg.ack).not.toHaveBeenCalled();
    expect(msg.nak).toHaveBeenCalledWith(CLAIM_LEASE_MS);
  });

  it("acks once the dead-letter row is saved", async () => {
    const { consumer, msg } = build(async () => undefined);
    await (consumer as never as { handleMessage(s: string, m: unknown): Promise<void> }).handleMessage("trace", msg);
    expect(msg.ack).toHaveBeenCalled();
  });
});
