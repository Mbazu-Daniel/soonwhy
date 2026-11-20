import { REQUEST_BODY_KEY, RESPONSE_BODY_KEY, SHAPE_MAX_DEPTH, SHAPE_MAX_FIELDS } from "./payload-shape.constants";
import type { PayloadShape, StoredPayload } from "./payload-shape.types";

function shapeOf(value: unknown, depth = 0): PayloadShape {
  if (value === null || value === undefined) return { type: "null" };
  if (Array.isArray(value)) {
    if (depth >= SHAPE_MAX_DEPTH) return { type: "deep" };
    return { type: "array", length: value.length, items: value.length ? shapeOf(value[0], depth + 1) : null };
  }
  if (typeof value === "object") {
    if (depth >= SHAPE_MAX_DEPTH) return { type: "deep" };
    const entries = Object.entries(value as Record<string, unknown>);
    const fields = Object.fromEntries(entries.slice(0, SHAPE_MAX_FIELDS).map(([key, item]) => [key, shapeOf(item, depth + 1)]));
    return entries.length > SHAPE_MAX_FIELDS ? { type: "object", fields, truncated: true } : { type: "object", fields };
  }
  if (typeof value === "number") return { type: "number" };
  if (typeof value === "boolean") return { type: "boolean" };
  return { type: "string" };
}

export function describePayload(raw: unknown): StoredPayload {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw) ?? "";
  const bytes = Buffer.byteLength(text);
  try {
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed !== null && typeof parsed === "object") return { bytes, format: "json", shape: shapeOf(parsed) };
  } catch {
    return { bytes, format: "text" };
  }
  return { bytes, format: "text" };
}

function alreadyDescribed(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  try {
    const parsed = JSON.parse(raw) as { bytes?: unknown; format?: unknown };
    return typeof parsed?.bytes === "number" && (parsed.format === "json" || parsed.format === "text");
  } catch {
    return false;
  }
}

export function shapePayloadAttributes(
  attributes: Record<string, unknown>,
  capture: { captureRequestBody: boolean; captureResponseBody: boolean },
): Record<string, unknown> {
  const result = { ...attributes };
  const rules: Array<[string, boolean]> = [
    [REQUEST_BODY_KEY, capture.captureRequestBody],
    [RESPONSE_BODY_KEY, capture.captureResponseBody],
  ];
  for (const [key, enabled] of rules) {
    if (!(key in result)) continue;
    if (enabled) result[key] = alreadyDescribed(result[key]) ? result[key] : JSON.stringify(describePayload(result[key]));
    else delete result[key];
  }
  return result;
}
