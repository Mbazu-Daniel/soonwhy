import postgres from "postgres";
import { assertTestDatabase } from "./database-guard";
import { databaseTestsEnabled } from "./database-enabled";

let resetClient: ReturnType<typeof postgres> | undefined;

export async function resetDatabase(): Promise<void> {
  if (!databaseTestsEnabled) return;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to reset the test database");
  assertTestDatabase(connectionString);
  resetClient ??= postgres(connectionString, { max: 1 });
  const tables = await resetClient<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'
  `;

  if (!tables.length) return;

  const list = tables.map((table) => `"${table.tablename}"`).join(", ");
  await resetClient.unsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function closeDatabase(): Promise<void> {
  await resetClient?.end();
  resetClient = undefined;
}
