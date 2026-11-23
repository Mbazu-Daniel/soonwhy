import { DEFAULT_SOURCE_DATABASE_URL, DEFAULT_TEST_DATABASE_NAME } from "./constants";

export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const url = new URL(process.env.DATABASE_URL ?? DEFAULT_SOURCE_DATABASE_URL);
  url.pathname = `/${DEFAULT_TEST_DATABASE_NAME}`;
  return url.toString();
}
