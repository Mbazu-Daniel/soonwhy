import { createScratchDatabase, databaseTestsEnabled, migrateUpTo, type ScratchDatabase } from "@soonwhy/test-support";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const BEFORE_REPLAY_STATUS = "0013_alert_trigger_one_active";
const REPLAY_STATUS_ADDED = "0014_dlq_replay_status";
const SCRATCH_DATABASE_TIMEOUT_MS = 180_000;

describe.skipIf(!databaseTestsEnabled)("DLQ migrations on an existing database", () => {
  let scratch: ScratchDatabase;
  let client: ReturnType<typeof postgres>;
  const ids: Record<string, number> = {};

  async function insertLegacyRow(label: string, replayed: boolean, replaySuccess: boolean | null) {
    const [row] = await client<{ id: number }[]>`
      insert into dead_letter_queue (signal, delivery_count, reason, payload, replayed, replay_success)
      values ('log', 6, ${label}, '{}'::jsonb, ${replayed}, ${replaySuccess})
      returning id
    `;
    ids[label] = row!.id;
  }

  async function statusOf(label: string) {
    const [row] = await client<{ replay_status: string }[]>`
      select replay_status from dead_letter_queue where id = ${ids[label]!}
    `;
    return row?.replay_status;
  }

  beforeAll(async () => {
    scratch = await createScratchDatabase("soonwhy_upgrade_test");
    await migrateUpTo(scratch.url, BEFORE_REPLAY_STATUS);
    client = postgres(scratch.url, { max: 1 });
    await insertLegacyRow("replayed-ok", true, true);
    await insertLegacyRow("replayed-failed", true, false);
    await insertLegacyRow("never-replayed", false, null);
    await insertLegacyRow("replayed-unknown", true, null);
  }, SCRATCH_DATABASE_TIMEOUT_MS);

  afterAll(async () => {
    await client?.end();
    await scratch?.drop();
  }, SCRATCH_DATABASE_TIMEOUT_MS);

  it("backfills the replay status from the legacy columns", { timeout: SCRATCH_DATABASE_TIMEOUT_MS }, async () => {
    await migrateUpTo(scratch.url, REPLAY_STATUS_ADDED);

    expect(await statusOf("replayed-ok")).toBe("succeeded");
    expect(await statusOf("replayed-failed")).toBe("failed");
    expect(await statusOf("never-replayed")).toBe("pending");
    expect(await statusOf("replayed-unknown")).toBe("pending");
  });

  it("drops the legacy columns and keeps every row and status", { timeout: SCRATCH_DATABASE_TIMEOUT_MS }, async () => {
    await migrateUpTo(scratch.url);

    const columns = await client<{ column_name: string }[]>`
      select column_name from information_schema.columns where table_name = 'dead_letter_queue'
    `;
    const names = columns.map((column) => column.column_name);
    expect(names).not.toContain("replayed");
    expect(names).not.toContain("replay_success");
    expect(names).toContain("replay_status");
    expect(await statusOf("replayed-ok")).toBe("succeeded");
    expect(await statusOf("replayed-failed")).toBe("failed");
    expect(await statusOf("never-replayed")).toBe("pending");
  });
});
