import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const apiRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const source = process.env.DATABASE_URL ?? "postgres://soonwhy:soonwhy@localhost:5433/soonwhy";
  const url = new URL(source);
  url.pathname = "/soonwhy_test";

  return url.toString();
}

const target = new URL(testDatabaseUrl());
const database = target.pathname.slice(1);

if (!/^[a-zA-Z0-9_]+$/.test(database)) {
  throw new Error(`Invalid test database name: ${database}`);
}

const admin = new URL(target);
admin.pathname = "/postgres";

const client = postgres(admin.toString(), { max: 1 });

try {
  const [row] = await client`
    select exists(select 1 from pg_database where datname = ${database}) as exists
  `;

  if (!row.exists) {
    await client.unsafe(`CREATE DATABASE "${database}"`);
  }
} finally {
  await client.end();
}

execFileSync(join(apiRoot, "node_modules", ".bin", "drizzle-kit"), ["push", "--force"], {
  cwd: apiRoot,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: target.toString() },
});
