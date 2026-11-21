import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/common/db";
import { findings } from "../../src/common/db/schema";
import { alertFinding } from "../../src/modules/v1/detection/findings/domain/alert-finding";
import { raiseFinding } from "../../src/modules/v1/detection/findings/infrastructure/raise-finding";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";
import { createOrganization, createProject } from "../support/fixtures";

const hour = 3_600_000;

describe.skipIf(!databaseTestsEnabled)("alert findings", () => {
  const at = new Date("2026-05-01T12:00:00.000Z");
  let input: Parameters<typeof alertFindingRow>[0];

  beforeEach(async () => {
    await resetDatabase();
    const organization = await createOrganization();
    const project = await createProject(organization!.id);
    input = {
      orgId: organization!.id, projectId: project!.id, ruleId: "rule-1", ruleName: "Checkout errors", ruleSeverity: "high",
      metric: "http.error_rate", operator: "gt", value: 0.2, threshold: 0.05, at,
    };
  });
  afterAll(closeDatabase);

  it("keeps one open finding per rule however often the alert fires", async () => {
    await raiseFinding(alertFinding(input), at);
    await raiseFinding(alertFinding({ ...input, value: 0.4 }), new Date(at.getTime() + hour));

    const rows = await db.select().from(findings);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "alert_rule", category: "error", severity: "critical", status: "open", occurrences: 2, observedValue: 0.4 });
  });

  it("reopens a resolved alert finding when the alert fires again", async () => {
    const first = await raiseFinding(alertFinding(input), at);
    await db.update(findings).set({ status: "resolved", resolvedAt: new Date(at.getTime() + 60_000) });
    await raiseFinding(alertFinding(input), new Date(at.getTime() + hour));

    const [row] = await db.select().from(findings);
    expect(row).toMatchObject({ id: first!.id, status: "open", resolvedAt: null });
  });
});
