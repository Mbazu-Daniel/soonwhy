import { sanitizeAttributes } from "../security.js";
import { type SecurityOptions } from "../security.types.js";
import type { Attributes } from "../types.js";
import { QUERY_SECRET_PARAM, URL_ATTRIBUTE_KEYS } from "./span-sanitizer.constants.js";
import type { SpanLike } from "./span-sanitizer.types.js";

function scrubUrl(value: string): string {
  return value.replace(QUERY_SECRET_PARAM, "$1$2=[REDACTED]");
}

function scrubQuery(value: string): string {
  return scrubUrl(`?${value}`).slice(1);
}

export function sanitizeSpan(span: SpanLike, options: SecurityOptions): void {
  if (!span.attributes) return;
  const cleaned = sanitizeAttributes(span.attributes as Attributes, options) as Record<string, unknown>;
  if (options.redactSensitiveData) {
    for (const key of URL_ATTRIBUTE_KEYS) {
      const value = cleaned[key];
      if (typeof value !== "string") continue;
      cleaned[key] = key === "url.query" ? scrubQuery(value) : scrubUrl(value);
    }
  }
  const target = span.attributes;
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, cleaned);
}
