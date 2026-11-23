import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { MIGRATIONS_FOLDER } from "./constants";
import { assertTestDatabase } from "./database-guard";
import { testDatabaseUrl } from "./database-url";
import { adminUrl, withClient } from "./with-client";

async function createIfMissing(connectionString: string, database: string): Promise<void> {
  await withClient(adminUrl(connectionString), async (client) => {
    const [row] = await client`
      select exists(select 1 from pg_database where datname = ${database}) as exists
    `;
    if (!row?.exists) await client.unsafe(`CREATE DATABASE "${database}"`);
  });
}

export async function ensureTestDatabase(): Promise<void> {
  const connectionString = testDatabaseUrl();
  const database = assertTestDatabase(connectionString);

  await createIfMissing(connectionString, database);
  await withClient(connectionString, (client) => migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER }));
}
