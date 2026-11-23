import { databaseTestsEnabled } from "./database-enabled";
import { ensureTestDatabase } from "./ensure-test-database";

export default async function setup(): Promise<void> {
  if (!databaseTestsEnabled) return;
  await ensureTestDatabase();
}
