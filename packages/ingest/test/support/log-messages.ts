import { vi } from "vitest";
import type { IngestConsumer } from "../../src/pipeline/consumer";

const resource = { serviceName: "api", serviceVersion: "1.0.0", environment: "test", region: "local" };
const TIMESTAMP = "2026-11-21T12:00:00.000Z";

function logItem(text: string) {
  return {
    timestamp: TIMESTAMP,
    message: text,
    severityNumber: 9,
    severityText: "INFO",
    severityLevel: "info",
    traceId: "",
    spanId: "",
    attributes: {},
    resource,
  };
}

export function logMessage(...texts: string[]) {
  const payload = { version: 1, signal: "log", projectId: "proj_1", organizationId: "org_1", items: texts.map(logItem) };
  return {
    subject: "ingest.proj_1.log",
    data: new TextEncoder().encode(JSON.stringify(payload)),
    info: { deliveryCount: 1 },
    ack: vi.fn(),
    nak: vi.fn(),
  };
}

export type LogMessage = ReturnType<typeof logMessage>;

export function deliver(consumer: IngestConsumer, msg: LogMessage): Promise<void> {
  return (consumer as unknown as { handleMessage(signal: string, msg: unknown): Promise<void> }).handleMessage("log", msg);
}
