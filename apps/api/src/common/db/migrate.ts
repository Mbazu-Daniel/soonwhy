import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const LOCK_KEY = 7_262_001;
const MIGRATIONS_FOLDER = join(__dirname, "..", "..", "..", "drizzle");

type Journal = { entries: Array<{ tag: string; when: number }> };

export async function markBaselineApplied(client: postgres.Sql, folder: string = MIGRATIONS_FOLDER): Promise<boolean> {
  const [state] = await client`
    select
      to_regclass('drizzle.__drizzle_migrations') is not null as has_table,
      to_regclass('public.organizations') is not null as has_schema
  `;
  if (!state?.has_schema) return false;
  if (state.has_table) {
    const [applied] = await client`select count(*)::int as count from drizzle.__drizzle_migrations`;
    if (applied && applied.count > 0) return false;
  }

  const journal = JSON.parse(readFileSync(`${folder}/meta/_journal.json`, "utf8")) as Journal;
  const baseline = journal.entries[0];
  if (!baseline) return false;
  const hash = createHash("sha256").update(readFileSync(`${folder}/${baseline.tag}.sql`, "utf8")).digest("hex");

  await client`create schema if not exists drizzle`;
  await client`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
  await client`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${baseline.when})`;
  return true;
}

export async function runMigrations(connectionString: string): Promise<void> {
  const client = postgres(connectionString, { max: 1, onnotice: () => undefined });
  try {
    await client`select pg_advisory_lock(${LOCK_KEY})`;
    if (await markBaselineApplied(client)) {
      console.warn("Existing database detected: recorded the baseline migration as already applied.");
    }
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await client`select pg_advisory_unlock(${LOCK_KEY})`.catch(() => undefined);
    await client.end();
  }
}

if (require.main === module) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  runMigrations(connectionString)
    .then(() => {
      console.log("Migrations applied");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
