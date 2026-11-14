import { createHash } from "node:crypto";
import { FINGERPRINT_LENGTH, MAX_MESSAGE_LENGTH } from "./error.constants";
import type { ErrorLogSource } from "./error.types";

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const LONG_HEX_PATTERN = /\b[0-9a-f]{16,}\b/gi;
const QUERY_STRING_PATTERN = /(\/[^\s?]*)\?\S*/g;
const NUMERIC_SEGMENT_PATTERN = /\/\d+(?=\/|\s|$)/g;
const LONG_NUMBER_PATTERN = /\b\d{4,}\b/g;
const WHITESPACE_PATTERN = /\s+/g;

export function normalizeErrorMessage(message: string): string {
  return message
    .replace(QUERY_STRING_PATTERN, "$1")
    .replace(UUID_PATTERN, "<id>")
    .replace(LONG_HEX_PATTERN, "<id>")
    .replace(NUMERIC_SEGMENT_PATTERN, "/:id")
    .replace(LONG_NUMBER_PATTERN, "<n>")
    .replace(WHITESPACE_PATTERN, " ")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

export function parseAttributes(
  attributes: ErrorLogSource["attributes"],
): Record<string, unknown> {
  if (!attributes) return {};
  if (typeof attributes !== "string") return attributes;
  try {
    const parsed: unknown = JSON.parse(attributes);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function errorTypeOf(source: ErrorLogSource): string {
  const attributes = parseAttributes(source.attributes);
  const exceptionType = attributes["exception.type"];
  if (typeof exceptionType === "string" && exceptionType) return exceptionType;
  const status = Number(attributes["http.status_code"]);
  if (Number.isFinite(status) && status >= 400) return `HTTP ${status}`;
  return "Error";
}

export function errorFingerprint(source: ErrorLogSource): string {
  const basis = [
    source.service ?? "",
    errorTypeOf(source),
    normalizeErrorMessage(source.message ?? ""),
  ].join("|");
  return createHash("sha1").update(basis).digest("hex").slice(0, FINGERPRINT_LENGTH);
}
