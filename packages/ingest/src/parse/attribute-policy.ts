import { isPiiKey, isPiiValue } from "@soonwhy/shared";
import { encryptOrRedact, encryptTextOrRedact } from "./pii-safe";
import { shapePayloadAttributes } from "./payload-shape";
import { sanitizeQueryAttributes } from "./sanitize-sql";
import { FREE_TEXT_ATTRIBUTE_KEYS } from "./exception-attributes";
import { SENSITIVE_ATTRIBUTE_PATTERN, SENSITIVE_TEXT_PATTERNS } from "./mappers.constants";
import type { CaptureSettings } from "../interfaces";

function safeLogAttributes(
  attributes: Record<string, unknown>,
  settings: CaptureSettings,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(attributes)
      .filter(([key]) => {
        if (SENSITIVE_ATTRIBUTE_PATTERN.test(key)) return false;
        return true;
      })
      .slice(0, Math.max(1, settings.maxAttributeCount))
      .map(([key, value]) => [key, sanitizePiiValue(key, value, settings, 0)]),
  ) as Record<string, string>;
}

function sanitizePiiValue(
  key: string,
  value: unknown,
  settings: CaptureSettings,
  depth: number,
): string {
  const maxLength = settings.maxAttributeValueLength;
  if (typeof value === "string") {
    if (FREE_TEXT_ATTRIBUTE_KEYS.has(key)) {
      return sanitizeSensitiveText(limitAttributeValue(value, maxLength, depth));
    }
    if (isPiiKey(key) || isPiiValue(value)) return encryptOrRedact(value);
    return sanitizeSensitiveText(limitAttributeValue(value, maxLength, depth));
  }
  if (value === null || typeof value !== "object") return String(value);
  if (depth >= 6) return "[TRUNCATED]";
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizePiiValue(key, item, settings, depth + 1))
      .join(", ");
  }
  return limitAttributeValue(
    JSON.stringify(value, (childKey, childValue) => {
      if (typeof childValue !== "string") return childValue;
      if (isPiiKey(childKey) || isPiiValue(childValue))
        return encryptOrRedact(childValue);
      return sanitizeSensitiveText(childValue);
    }),
    maxLength,
  );
}
function limitAttributeValue(
  value: unknown,
  maxLength: number,
  depth = 0,
): string {
  if (typeof value === "string") return value.slice(0, maxLength);
  if (value === null || typeof value !== "object") return String(value);
  if (depth >= 6) return String(value);
  if (Array.isArray(value))
    return value
      .map((item) => limitAttributeValue(item, maxLength, depth + 1))
      .join(", ");
  return JSON.stringify(value);
}
export function sanitizeSensitiveText(value: string, enabled = true): string {
  const secretsRedacted = enabled
    ? SENSITIVE_TEXT_PATTERNS.reduce(
        (text, pattern) => text.replace(pattern, "$1[REDACTED]"),
        value,
      )
    : value;
  return encryptTextOrRedact(secretsRedacted);
}

export function applyLogAttributePolicy(
  attributes: Record<string, unknown>,
  settings: CaptureSettings,
): Record<string, string> {
  return safeLogAttributes(attributes, settings);
}

export function applySpanAttributePolicy(
  attributes: Record<string, unknown>,
  settings: CaptureSettings,
): Record<string, string> {
  const present = Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== undefined));
  return safeLogAttributes(sanitizeQueryAttributes(shapePayloadAttributes(present, settings)), settings);
}
