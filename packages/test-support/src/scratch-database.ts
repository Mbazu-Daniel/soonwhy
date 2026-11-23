import { assertTestDatabase } from "./database-guard";
import { testDatabaseUrl } from "./database-url";
import type { ScratchDatabase } from "./scratch-database.types";
import { adminUrl, databaseUrl, withClient } from "./with-client";

const dropStatement = (name: string): string => `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`;

export async function createScratchDatabase(name: string): Promise<ScratchDatabase> {
  const url = databaseUrl(testDatabaseUrl(), name);
  assertTestDatabase(url);
  const admin = adminUrl(url);

  await withClient(admin, async (client) => {
    await client.unsafe(dropStatement(name));
    await client.unsafe(`CREATE DATABASE "${name}"`);
  });

  return { url, drop: () => withClient(admin, async (client) => void (await client.unsafe(dropStatement(name)))) };
}
