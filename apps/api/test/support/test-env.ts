// fallow-ignore-file unused-file
// Used by vitest.e2e.config.ts (setupFiles); fallow cannot see setup references.
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const source = process.env.DATABASE_URL ?? "postgres://soonwhy:soonwhy@localhost:5433/soonwhy";
  const url = new URL(source);
  url.pathname = "/soonwhy_test";

  return url.toString();
}

if (process.env.RUN_DB_TESTS === "1") {
  process.env.DATABASE_URL = testDatabaseUrl();
}
