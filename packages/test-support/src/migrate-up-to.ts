import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { MIGRATIONS_FOLDER } from "./constants";
import type { Journal } from "./migrate-up-to.types";
import { withClient } from "./with-client";

export async function migrateUpTo(connectionString: string, lastTag?: string): Promise<void> {
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8")) as Journal;
  const lastIndex = lastTag ? journal.entries.findIndex((entry) => entry.tag === lastTag) : journal.entries.length - 1;
  if (lastIndex < 0) throw new Error(`Unknown migration: ${lastTag}`);

  const folder = mkdtempSync(join(tmpdir(), "soonwhy-migrations-"));
  try {
    mkdirSync(join(folder, "meta"));
    const entries = journal.entries.slice(0, lastIndex + 1);
    writeFileSync(join(folder, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
    for (const entry of entries) copyFileSync(join(MIGRATIONS_FOLDER, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`));

    await withClient(connectionString, (client) => migrate(drizzle(client), { migrationsFolder: folder }));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
