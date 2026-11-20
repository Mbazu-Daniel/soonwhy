import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/common/db";
import { alertRules, alertTriggers, findings } from "../../src/common/db/schema";
import { AlertRuleEngineService } from "../../src/modules/v1/notifications/alert-engine/alert-rule-engine.service";
import { AlertEvaluationService } from "../../src/modules/v1/notifications/application/alert-evaluation.service";
import { DedupService } from "../../src/modules/v1/notifications/dedup/dedup.service";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";
import { createOrganization, createProject } from "../support/fixtures";

const FAILING = { _2xx: 50, _4xx: 0, _5xx: 50, count: 100, p95: 900 };
const HEALTHY = { _2xx: 100, _4xx: 0, _5xx: 0, count: 100, p95: 90 };

describe.skipIf(!databaseTestsEnabled)("alert rules and findings", () => {
  let orgId: string;
  let projectId: string;
  let bucket: typeof FAILING;
  const dispatchAlert = vi.fn().mockResolvedValue(undefined);
  let service: AlertEvaluationService;

  const evaluate = (times = 1) => (async () => { for (let i = 0; i < times; i += 1) await service.evaluateProjectRules(orgId, projectId); })();

  async function createRule(findingCategory?: "error" | "performance" | "security" | "vulnerability") {
    const [rule] = await db
      .insert(alertRules)
      .values({
        orgId,
        projectId,
        name: "Checkout errors",
        minSeverity: "high",
        status: "active",
        dedupeWindowSeconds: 300,
        findingCategory: findingCategory ?? null,
        conditions: [{ type: "threshold", metric: "http.server.request.errors.rate", operator: "gt", value: 5, window: "5m", negate: false }],
      })
      .returning();
    return rule!;
  }

  beforeEach(async () => {
    await resetDatabase();
    const organization = await createOrganization();
    const project = await createProject(organization!.id);
    orgId = organization!.id;
    projectId = project!.id;
    bucket = FAILING;
    dispatchAlert.mockClear();
    service = new AlertEvaluationService(
      { queryMetrics: async () => [bucket], countHostSamples: async () => 0 } as never,
      { dispatchAlert } as never,
      new AlertRuleEngineService(),
      { createOrUpdateIncident: vi.fn().mockResolvedValue(undefined), checkForRecovery: vi.fn().mockResolvedValue(undefined) } as never,
      { isAlertSuppressed: vi.fn().mockResolvedValue(false) } as never,
      new DedupService(),
    );
  });
  afterAll(closeDatabase);

  it("waits for the condition to hold twice in a row before alerting or flagging", async () => {
    await createRule();
    await evaluate();
    expect(dispatchAlert).not.toHaveBeenCalled();
    expect(await db.select().from(findings)).toHaveLength(0);
  });

  it("flags a finding when the alert fires, filed by what the metric implies", async () => {
    const rule = await createRule();
    await evaluate(2);

    expect(dispatchAlert).toHaveBeenCalledTimes(1);
    const rows = await db.select().from(findings);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "alert_rule", category: "error", severity: "critical", status: "open",
      title: "Alert: Checkout errors", fingerprint: `alert_rule:Alert rules:${rule.id}`, observedValue: 50, threshold: 5,
    });
    expect(rows[0]!.recommendation).toContain("alert rule");
  });

  it("files the finding under the category the rule's owner chose", async () => {
    await createRule("security");
    await evaluate(2);
    expect((await db.select().from(findings))[0]!.category).toBe("security");
  });

  it("sends one notification and keeps one finding while the alert keeps firing", async () => {
    await createRule();
    await evaluate(5);
    expect(dispatchAlert).toHaveBeenCalledTimes(1);
    expect(await db.select().from(findings)).toHaveLength(1);
    expect(await db.select().from(alertTriggers)).toHaveLength(1);
  });

  it("resolves the finding when the alert recovers and reopens it if the alert fires again", async () => {
    const rule = await createRule();
    await evaluate(2);

    bucket = HEALTHY;
    await service.evaluateProjectRules(orgId, projectId);
    const [recovered] = await db.select().from(findings);
    expect(recovered).toMatchObject({ status: "resolved", resolvedBy: null });
    expect(recovered!.resolvedAt).not.toBeNull();
    expect((await db.select().from(alertTriggers).where(eq(alertTriggers.alertRuleId, rule.id)))[0]!.status).toBe("resolved");

    await db.update(findings).set({ resolvedAt: new Date(Date.now() - 3_600_000) });
    bucket = FAILING;
    await evaluate(2);
    const [reopened] = await db.select().from(findings);
    expect(reopened).toMatchObject({ id: recovered!.id, status: "open", resolvedAt: null });
  });

  it("leaves a finding the user ignored alone when the alert recovers", async () => {
    await createRule();
    await evaluate(2);
    await db.update(findings).set({ status: "ignored" });

    bucket = HEALTHY;
    await service.evaluateProjectRules(orgId, projectId);
    expect((await db.select().from(findings))[0]!.status).toBe("ignored");
  });
});
