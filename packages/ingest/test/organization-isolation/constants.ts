import type { ParsedLogRecord } from "../../src/interfaces";

export const SIGNAL = "log";

export const SHARED_PAYLOAD = {
  timestamp: "2026-11-21T12:00:00.000Z",
  message: "payment failed",
  severityNumber: 17,
  severityText: "ERROR",
  severityLevel: "error",
  traceId: "",
  spanId: "",
  attributes: {},
  resource: { serviceName: "checkout", serviceVersion: "1.0.0", environment: "prod", region: "eu" },
} as ParsedLogRecord;
