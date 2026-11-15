import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { markBaselineApplied } from "./migrate";

function folder() {
  const dir = mkdtempSync(join(tmpdir(), "migrations-"));
  mkdirSync(join(dir, "meta"));
  writeFileSync(join(dir, "meta", "_journal.json"), JSON.stringify({ entries: [{ tag: "0000_baseline", when: 1234 }] }));
  writeFileSync(join(dir, "0000_baseline.sql"), "CREATE TABLE x (id int);");
  return dir;
}

function client(state: { has_table: boolean; has_schema: boolean }, applied = 0) {
  const calls: unknown[][] = [];
  const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push([strings.join("?"), ...values]);
    const text = strings.join("?");
    if (text.includes("to_regclass")) return [state];
    if (text.includes("count(*)")) return [{ count: applied }];
    return [];
  });
  return { sql: sql as never, calls };
}

describe("markBaselineApplied", () => {
  it("does nothing on a fresh database, so the baseline runs normally", async () => {
    const { sql, calls } = client({ has_table: false, has_schema: false });
    expect(await markBaselineApplied(sql, folder())).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("does nothing once migration history has rows", async () => {
    const { sql, calls } = client({ has_table: true, has_schema: true }, 2);
    expect(await markBaselineApplied(sql, folder())).toBe(false);
    expect(calls.some(([text]) => String(text).includes("insert into"))).toBe(false);
  });

  it("still records the baseline when the history table exists but is empty", async () => {
    const { sql, calls } = client({ has_table: true, has_schema: true }, 0);
    expect(await markBaselineApplied(sql, folder())).toBe(true);
    expect(calls.some(([text]) => String(text).includes("insert into"))).toBe(true);
  });

  it("records the baseline for a database that was built without migrations", async () => {
    const { sql, calls } = client({ has_table: false, has_schema: true });
    expect(await markBaselineApplied(sql, folder())).toBe(true);
    const insert = calls.find(([text]) => String(text).includes("insert into"))!;
    expect(insert[1]).toBe(createHash("sha256").update("CREATE TABLE x (id int);").digest("hex"));
    expect(insert[2]).toBe(1234);
  });
});
