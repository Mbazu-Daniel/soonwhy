import { describe, expect, it } from "vitest";
import { sanitizeDatabaseQuery } from "./sanitize-sql";

describe("sanitizeDatabaseQuery", () => {
  it("replaces string and numeric literals but keeps the query shape", () => {
    expect(sanitizeDatabaseQuery("SELECT * FROM users WHERE email = 'a@b.com' AND age > 30 AND ok = true")).toBe(
      "SELECT * FROM users WHERE email = ? AND age > ? AND ok = ?",
    );
  });

  it("treats positional placeholders as the same shape whatever their number", () => {
    expect(sanitizeDatabaseQuery("SELECT * FROM t WHERE id = $1 AND x = $2")).toBe("SELECT * FROM t WHERE id = $? AND x = $?");
  });

  it("hides the whole of a string with a backslash-escaped quote", () => {
    const out = sanitizeDatabaseQuery(String.raw`SELECT * FROM users WHERE name = 'it\'s Bob Smith private'`);
    expect(out).toBe("SELECT * FROM users WHERE name = ?");
  });

  it("hides doubled quotes inside a string", () => {
    expect(sanitizeDatabaseQuery("SELECT 'it''s secret'")).toBe("SELECT ?");
  });

  it("hides dollar-quoted strings, tagged or not", () => {
    expect(sanitizeDatabaseQuery("SELECT $$hunter2 secret$$, $tag$more secret$tag$")).toBe("SELECT ?, ?");
  });

  it("removes comments, which can carry data", () => {
    expect(sanitizeDatabaseQuery("SELECT 1 -- token abc123secret\nFROM t /* api_key=zzz */")).toBe("SELECT ? FROM t");
  });

  it("hides hex and exponent literals", () => {
    expect(sanitizeDatabaseQuery("SELECT 0xDEADBEEF, 1e10")).toBe("SELECT ?, ?");
  });

  it("keeps double-quoted identifiers for Postgres but hides them as strings for MySQL", () => {
    const query = 'SELECT "name" FROM "order_items" WHERE id = 5';
    expect(sanitizeDatabaseQuery(query, "postgresql")).toBe('SELECT "name" FROM "order_items" WHERE id = ?');
    expect(sanitizeDatabaseQuery(query, "mysql")).toBe("SELECT ? FROM ? WHERE id = ?");
  });

  it("hides an unterminated string rather than leaking its tail", () => {
    expect(sanitizeDatabaseQuery("SELECT 'never closed secret")).toBe("SELECT ?");
  });

  it("does not touch digits inside identifiers", () => {
    expect(sanitizeDatabaseQuery("SELECT col2 FROM table_v2")).toBe("SELECT col2 FROM table_v2");
  });
});
