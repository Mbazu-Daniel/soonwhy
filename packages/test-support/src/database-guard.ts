import { DATABASE_NAME_PATTERN, TEST_DATABASE_NAME_PATTERN } from "./constants";

export function assertTestDatabase(connectionString: string): string {
  const database = new URL(connectionString).pathname.slice(1);
  if (!DATABASE_NAME_PATTERN.test(database)) throw new Error(`Invalid test database name: ${database}`);
  if (!TEST_DATABASE_NAME_PATTERN.test(database)) {
    throw new Error(`Refusing to use "${database}" as a test database: its name must contain "test"`);
  }
  return database;
}
