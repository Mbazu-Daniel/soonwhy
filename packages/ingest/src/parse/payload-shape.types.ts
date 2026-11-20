export type PayloadShape =
  | { type: "string" | "number" | "boolean" | "null" }
  | { type: "array"; length: number; items: PayloadShape | null }
  | { type: "object"; fields: Record<string, PayloadShape>; truncated?: true }
  | { type: "deep" };

export type StoredPayload = { bytes: number; format: "json" | "text"; shape?: PayloadShape };
