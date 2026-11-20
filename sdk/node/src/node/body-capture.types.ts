export type PayloadShape =
  | { type: "string" | "number" | "boolean" | "null" | "deep" }
  | { type: "array"; length: number; items: PayloadShape | null }
  | { type: "object"; fields: Record<string, PayloadShape>; truncated?: true };

export type StoredPayload = { bytes: number; format: "json" | "text"; shape?: PayloadShape };

export interface BodySpan {
  setAttribute(key: string, value: string): unknown;
}

export interface BodyCaptureOptions {
  maxBytes: number;
  maxAttributeValueLength: number;
}

export interface CapturedBody {
  chunks: Buffer[];
  size: number;
  total: number;
}
