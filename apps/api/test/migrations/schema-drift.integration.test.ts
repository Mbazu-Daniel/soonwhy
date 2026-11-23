import { createScratchDatabase, databaseTestsEnabled, migrateUpTo, type ScratchDatabase } from "@soonwhy/test-support";
import { pushSchema } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../src/common/db/schema";
import { KNOWN_INTROSPECTION_NOISE, SCRATCH_DATABASE_TIMEOUT_MS } from "./schema-drift.constants";

describe.skipIf(!databaseTestsEnabled)("schema and migrations agree", () => {
  let scratch: ScratchDatabase;
  let client: ReturnType<typeof postgres>;

  async function statementsToMatchSchema(): Promise<string[]> {
    const db = drizzle(client);
    const adapter = { execute: async (query: Parameters<typeof db.execute>[0]) => ({ rows: await db.execute(query) }) };
    const { statementsToExecute } = await pushSchema(schema, adapter as never);
    return statementsToExecute.filter((statement) => !KNOWN_INTROSPECTION_NOISE.has(statement));
  }

  beforeAll(async () => {
    scratch = await createScratchDatabase("soonwhy_drift_test");
    await migrateUpTo(scratch.url);
    client = postgres(scratch.url, { max: 1 });
  }, SCRATCH_DATABASE_TIMEOUT_MS);

  afterAll(async () => {
    await client?.end();
    await scratch?.drop();
  }, SCRATCH_DATABASE_TIMEOUT_MS);

  it("needs no statement to turn the migrated database into the ORM schema", { timeout: SCRATCH_DATABASE_TIMEOUT_MS }, async () => {
    expect(await statementsToMatchSchema()).toEqual([]);
  });

  it("notices a column that exists in the database but not in the schema", { timeout: SCRATCH_DATABASE_TIMEOUT_MS }, async () => {
    await client`alter table projects add column drift_probe text`;
    const statements = await statementsToMatchSchema();
    expect(statements.some((statement) => statement.includes("drift_probe"))).toBe(true);
  });
});
