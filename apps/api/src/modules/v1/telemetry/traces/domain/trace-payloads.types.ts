import type { PayloadIssue, PayloadReport, PayloadSide } from "@soonwhy/shared/contracts";

export type { PayloadIssue, PayloadReport, PayloadSide };

export type PayloadShape =
  | { type: "string" | "number" | "boolean" | "null" | "deep" }
  | { type: "array"; length: number; items: PayloadShape | null }
  | { type: "object"; fields: Record<string, PayloadShape> };

export type PayloadSpan = { spanId: string; name: string; attributes?: Record<string, unknown> };
