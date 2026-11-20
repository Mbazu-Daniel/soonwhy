import {
  DOUBLE_QUOTE_STRING_SYSTEMS,
  SQL_MAX_LENGTH,
  SQL_PLACEHOLDER,
  SQL_SYSTEM_ATTRIBUTE_KEYS,
  SQL_TEXT_ATTRIBUTE_KEYS,
  SQL_TOKEN_PATTERN,
} from "./sanitize-sql.constants";

export function sanitizeDatabaseQuery(query: string, system = ""): string {
  const doubleQuotesAreStrings = DOUBLE_QUOTE_STRING_SYSTEMS.includes(system.toLowerCase());
  return query
    .replace(SQL_TOKEN_PATTERN, (match, ...args) => {
      const groups = args[args.length - 1] as Record<string, string | undefined>;
      if (groups.block !== undefined || groups.line !== undefined) return " ";
      if (groups.double !== undefined && !doubleQuotesAreStrings) return match;
      return SQL_PLACEHOLDER;
    })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SQL_MAX_LENGTH);
}

export function sanitizeQueryAttributes(attributes: Record<string, unknown>): Record<string, unknown> {
  const system = SQL_SYSTEM_ATTRIBUTE_KEYS.map((key) => attributes[key]).find((value) => typeof value === "string") as string | undefined;
  const sanitized = { ...attributes };
  for (const key of SQL_TEXT_ATTRIBUTE_KEYS) {
    if (typeof sanitized[key] === "string") sanitized[key] = sanitizeDatabaseQuery(sanitized[key], system);
  }
  return sanitized;
}
