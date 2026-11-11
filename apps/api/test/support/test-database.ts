import postgres from "postgres";

export const databaseTestsEnabled = process.env.RUN_DB_TESTS === "1";

let resetClient: ReturnType<typeof postgres> | undefined;

export async function resetDatabase(): Promise<void> {
  if (!databaseTestsEnabled) return;

  resetClient ??= postgres(process.env.DATABASE_URL!, { max: 1 });
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
