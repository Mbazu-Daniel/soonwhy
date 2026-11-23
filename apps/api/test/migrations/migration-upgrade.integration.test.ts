import { createScratchDatabase, databaseTestsEnabled, migrateUpTo, type ScratchDatabase } from "@soonwhy/test-support";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SCRATCH_DATABASE_TIMEOUT_MS } from "./schema-drift.constants";

const BEFORE_FINDING_LIFECYCLE = "0009_usage_project_set_null";
const BEFORE_ONE_ACTIVE_TRIGGER = "0012_alert_rule_finding_category";
const WINDOW_START = "2026-01-01T00:00:00Z";
const WINDOW_END = "2026-01-01T00:15:00Z";

describe.skipIf(!databaseTestsEnabled)("migrations on a database that already holds data", () => {
  let scratch: ScratchDatabase;
  let client: ReturnType<typeof postgres>;

  async function insertFinding(id: string, type: string) {
    await client`
      insert into findings (id, org_id, project_id, service_name, type, severity, title, description, observed_value, threshold, unit, window_start, window_end, evidence)
      values (${id}, 'org1', 'proj1', 'api', ${type}, 'critical', ${`title ${id}`}, 'd', 1250, 500, 'ms', ${WINDOW_START}, ${WINDOW_END}, '[]'::jsonb)
    `;
  }

  async function insertTrigger(id: string, ruleId: string, triggeredAt: string) {
    await client`
      insert into alert_triggers (id, org_id, project_id, alert_rule_id, alert_name, severity, status, triggered_at)
      values (${id}, 'org1', 'proj1', ${ruleId}, ${`rule ${ruleId}`}, 'critical', 'active', ${triggeredAt})
    `;
  }

  beforeAll(async () => {
    scratch = await createScratchDatabase("soonwhy_upgrade_history_test");
    await migrateUpTo(scratch.url, BEFORE_FINDING_LIFECYCLE);
    client = postgres(scratch.url, { max: 1 });

    await client`insert into organizations (id, name, slug) values ('org1', 'Acme', 'acme')`;
    await client`insert into projects (id, organization_id, name, slug) values ('proj1', 'org1', 'Shop', 'shop')`;
    await insertFinding("f-latency", "latency");
    await insertFinding("f-error-group", "error_group");
    await insertFinding("f-error-rate", "error_rate");
    await insertFinding("f-db-error", "database_error");

    await migrateUpTo(scratch.url, BEFORE_ONE_ACTIVE_TRIGGER);
    for (const ruleId of ["rule1", "rule2"]) {
      await client`insert into alert_rules (id, org_id, project_id, name, min_severity) values (${ruleId}, 'org1', 'proj1', ${ruleId}, 'warning')`;
    }
    await insertTrigger("t-old", "rule1", "2026-01-01T10:00:00Z");
    await insertTrigger("t-newest", "rule1", "2026-01-01T12:00:00Z");
    await insertTrigger("t-middle", "rule1", "2026-01-01T11:00:00Z");
    await insertTrigger("t-only", "rule2", "2026-01-01T09:00:00Z");

    await migrateUpTo(scratch.url);
  }, SCRATCH_DATABASE_TIMEOUT_MS);

  afterAll(async () => {
    await client?.end();
    await scratch?.drop();
  }, SCRATCH_DATABASE_TIMEOUT_MS);

  it("keeps the organization, project and every finding with its values", async () => {
    const [organization] = await client`select name, slug from organizations where id = 'org1'`;
    expect(organization).toEqual({ name: "Acme", slug: "acme" });
    const [project] = await client`select organization_id, name from projects where id = 'proj1'`;
    expect(project).toEqual({ organization_id: "org1", name: "Shop" });
    const findings = await client`select id, observed_value, title from findings order by id`;
    expect(findings).toHaveLength(4);
    expect(findings.find((row) => row.id === "f-latency")).toMatchObject({ observed_value: 1250, title: "title f-latency" });
  });

  it("backfills the finding category from the finding type and gives old findings the lifecycle defaults", async () => {
    const rows = await client<{ id: string; category: string; status: string; occurrences: number; fingerprint: string | null }[]>`
      select id, category, status, occurrences, fingerprint from findings order by id
    `;
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId["f-latency"]?.category).toBe("performance");
    expect(byId["f-error-group"]?.category).toBe("error");
    expect(byId["f-error-rate"]?.category).toBe("error");
    expect(byId["f-db-error"]?.category).toBe("error");
    for (const row of rows) expect(row).toMatchObject({ status: "open", occurrences: 1, fingerprint: null });
  });

  it("leaves one active trigger per rule, the newest, and resolves the rest without deleting them", async () => {
    const rows = await client<{ id: string; status: string; state: string }[]>`select id, status, state from alert_triggers order by id`;
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(rows).toHaveLength(4);
    expect(byId["t-newest"]?.status).toBe("active");
    expect(byId["t-only"]?.status).toBe("active");
    expect(byId["t-old"]).toMatchObject({ status: "resolved", state: "healthy" });
    expect(byId["t-middle"]).toMatchObject({ status: "resolved", state: "healthy" });
  });

  it("enforces one active trigger per rule from then on", async () => {
    await expect(insertTrigger("t-second-active", "rule1", "2026-01-02T00:00:00Z")).rejects.toThrow(/alert_triggers_one_active_per_rule_uidx/);
  });
});
