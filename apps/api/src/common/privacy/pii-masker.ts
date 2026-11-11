import {
  PII_RULES,
  REDACTED,
  SENSITIVE_KEY_PATTERN,
} from "./pii.constants";

export function maskPii(value: string): string {
  return PII_RULES.reduce(
    (masked, rule) => masked.replace(rule.pattern, rule.replacement),
    value,
  );
}

export function maskPiiValue(value: unknown): unknown {
  if (typeof value === "string") return maskPii(value);

  if (value instanceof Error) {
    return `${value.name}: ${maskPii(value.message)}`;
  }

  if (Array.isArray(value)) return value.map(maskPiiValue);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : maskPiiValue(entry),
      ]),
    );
  }

  return value;
}
