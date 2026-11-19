import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../src/common/db";
import { alertRules, incidentTimelineEvents, notificationChannels, notificationLogs } from "../../src/common/db/schema";
import { OutboundHttpService } from "../../src/common/resilience/outbound-http.service";
import { createIssueKey, resolveIssue } from "../../src/modules/v1/detection/intelligence/domain/issue-lifecycle.engine";
import { IssueLifecycleRepository } from "../../src/modules/v1/detection/intelligence/infrastructure/issue-lifecycle.repository";
import { IssueLifecycleService } from "../../src/modules/v1/detection/intelligence/application/issue-lifecycle.service";
import type { Issue } from "../../src/modules/v1/detection/intelligence/domain/issue.types";
import type { TelemetryIdentity } from "@soonwhy/shared";
import { WebhookChannel } from "../../src/modules/v1/notifications/channels/webhook.channel";
import { NotificationDispatcher } from "../../src/modules/v1/notifications/domain/notification-dispatcher";
import { WebhookService } from "../../src/modules/v1/notifications/application/webhook.service";
import { createOrganization, createProject } from "../support/fixtures";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/common/net/public-http", () => ({
  publicHttpRequest: (input: unknown) => sendMock(input),
}));

const PUBLIC_HOOK = "http://93.184.216.34/hooks/soonwhy";

const identity: TelemetryIdentity = {
  domain: "database",
  fingerprint: "slow-checkout-query",
  fingerprintVersion: 1,
  serviceName: "checkout-api",
  operationName: "POST /checkout",
};

function issueObservedAt(observedAt: string): Issue {
  return {
    identity,
    confidence: { identity, score: 0.9, status: "confirmed", observationCount: 5, windowCount: 3, independentSourceCount: 2 },
    status: "confirmed",
    observations: [{ name: "query.duration", value: 1600, source: "database", observedAt }],
    windows: [{ start: observedAt, end: observedAt }],
    firstObservedAt: observedAt,
    lastObservedAt: observedAt,
  };
}

const passthroughResilience = {
  preset: () => ({
    execute: (run: (context: { signal: AbortSignal }) => Promise<unknown>) => run({ signal: new AbortController().signal }),
  }),
};

describe.skipIf(!databaseTestsEnabled)("detect to alert, on a real database", () => {
  const lifecycle = new IssueLifecycleService(new IssueLifecycleRepository());
  const lifecycleRepository = new IssueLifecycleRepository();
  const dispatcher = new NotificationDispatcher(
    { send: vi.fn() } as never,
    { send: vi.fn() } as never,
    new WebhookChannel(new WebhookService(new OutboundHttpService(passthroughResilience as never))),
  );
  beforeEach(async () => {
    await resetDatabase();
    sendMock.mockReset();
    sendMock.mockResolvedValue({ status: 200 });
  });

  afterAll(closeDatabase);

  async function setUpAlerting(webhookUrl: string, minSeverity: "critical" | "high" | "medium" | "low" = "high") {
    const org = await createOrganization();
    const project = await createProject(org!.id);
    const [channel] = await db
      .insert(notificationChannels)
      .values({ orgId: org!.id, projectId: project!.id, name: "ops hook", type: "webhook", webhookUrl, webhookSecret: "shh" })
      .returning();
    await db.insert(alertRules).values({
      orgId: org!.id,
      projectId: project!.id,
      name: "page me",
      minSeverity,
      channelIds: [channel!.id],
    });
    return { orgId: org!.id, projectId: project!.id, channelId: channel!.id };
  }

  it("keeps one issue per fingerprint through create, update, resolve and reopen", async () => {
    const org = await createOrganization();
    const project = await createProject(org!.id);
    const scope = { orgId: org!.id, projectId: project!.id };

    const first = await lifecycle.apply({ ...scope, issue: issueObservedAt("2026-11-18T10:00:00.000Z") });
    expect(first.action).toBe("created");

    const later = await lifecycle.apply({ ...scope, issue: issueObservedAt("2026-11-18T10:05:00.000Z") });
    expect(later.action).toBe("updated");
    expect(later.lifecycle?.firstObservedAt).toBe("2026-11-18T10:00:00.000Z");

    const key = createIssueKey(identity);
    const stored = await lifecycleRepository.find(scope.orgId, scope.projectId, key);
    const resolved = resolveIssue(stored!, "2026-11-18T10:10:00.000Z");
    await lifecycleRepository.save({ ...scope, lifecycle: resolved! });
    expect((await lifecycleRepository.find(scope.orgId, scope.projectId, key))?.status).toBe("resolved");

    const regressed = await lifecycle.apply({ ...scope, issue: issueObservedAt("2026-11-18T11:00:00.000Z") });
    expect(regressed.action).toBe("reopened");
    expect(await lifecycleRepository.list(scope.orgId, scope.projectId)).toHaveLength(1);
  });

  it("sends a signed webhook for an alert at or above the rule's severity and records it", async () => {
    const { orgId, projectId, channelId } = await setUpAlerting(PUBLIC_HOOK);
    const incidentId = createIssueKey(identity);

    const result = await dispatcher.dispatchAlert({ orgId, projectId, incidentId, severity: "critical", title: "Checkout is slow", body: "p95 1600ms" });

    expect(result).toMatchObject({ sent: 1, failed: 0 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [sent] = sendMock.mock.calls[0] as [{ url: string; method: string; headers: Record<string, string>; body: string }];
    expect(sent.url).toBe(PUBLIC_HOOK);
    expect(sent.method).toBe("POST");
    expect(sent.headers).toHaveProperty("X-Soonwhy-Signature");
    expect(JSON.parse(sent.body)).toMatchObject({ subject: "Checkout is slow" });

    const logs = await db.select().from(notificationLogs).where(eq(notificationLogs.channelId, channelId));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: "sent", incidentId });
    const timeline = await db.select().from(incidentTimelineEvents).where(eq(incidentTimelineEvents.incidentId, incidentId));
    expect(timeline.map((event) => event.type)).toContain("notification_sent");
  });

  it("does not notify twice for the same incident and channel", async () => {
    const { orgId, projectId } = await setUpAlerting(PUBLIC_HOOK);
    const input = { orgId, projectId, incidentId: createIssueKey(identity), severity: "critical" as const, title: "t", body: "b" };

    await dispatcher.dispatchAlert(input);
    await dispatcher.dispatchAlert(input);

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("stays quiet for an alert below the rule's severity", async () => {
    const { orgId, projectId } = await setUpAlerting(PUBLIC_HOOK, "critical");

    const result = await dispatcher.dispatchAlert({ orgId, projectId, incidentId: "i-low", severity: "low", title: "t", body: "b" });

    expect(result.sent).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("refuses to deliver to an internal address stored on a channel", async () => {
    const { orgId, projectId, channelId } = await setUpAlerting("http://169.254.169.254/latest/meta-data");

    const result = await dispatcher.dispatchAlert({ orgId, projectId, incidentId: "i-ssrf", severity: "critical", title: "t", body: "b" });

    expect(result).toMatchObject({ sent: 0, failed: 1 });
    expect(sendMock).not.toHaveBeenCalled();
    const [log] = await db.select().from(notificationLogs).where(eq(notificationLogs.channelId, channelId));
    expect(log?.status).toBe("failed");
  });
});
