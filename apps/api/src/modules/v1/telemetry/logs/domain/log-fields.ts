import { BadRequestException } from "@nestjs/common";
import { ATTRIBUTE_FIELD_PREFIX, CORE_LOG_FIELDS, FIELD_NAME_PATTERN, MAX_FIELD_NAMES } from "./logs.constants";
import type { LogFieldName } from "./log-fields.types";

export function parseAttributes(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function fieldNamesFromSample(rows: Array<{ attributes?: unknown }>): LogFieldName[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const key of Object.keys(parseAttributes(row.attributes))) {
      if (FIELD_NAME_PATTERN.test(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const attributes = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_FIELD_NAMES)
    .map(([key, count]): LogFieldName => ({
      name: `${ATTRIBUTE_FIELD_PREFIX}${key}`,
      kind: "attribute",
      count,
    }));
  const core = CORE_LOG_FIELDS.map((name): LogFieldName => ({
    name,
    kind: "core",
    count: rows.length,
  }));
  return [...core, ...attributes];
}

export function assertQueryableField(field: string): string {
  const isCore = (CORE_LOG_FIELDS as readonly string[]).includes(field);
  const isAttribute =
    field.startsWith(ATTRIBUTE_FIELD_PREFIX) &&
    FIELD_NAME_PATTERN.test(field.slice(ATTRIBUTE_FIELD_PREFIX.length));
  if (!isCore && !isAttribute) throw new BadRequestException(`Unknown log field: ${field}`);
  return field;
}
