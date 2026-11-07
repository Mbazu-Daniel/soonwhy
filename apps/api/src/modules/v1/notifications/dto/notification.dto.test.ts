import { describe, expect, it } from "vitest";
import { toNotificationLogDto } from "./notification.dto";

describe("toNotificationLogDto", () => {
  it("prefers payload title then subject for the history title", () => {
    const createdAt = new Date("2026-10-27T10:00:00.000Z");
    const titled = toNotificationLogDto({
      id: "log-1",
      orgId: "org-1",
      projectId: "proj-1",
      channelId: "ch-1",
      channelType: "email",
      incidentId: "inc-1",
      alertRuleId: "rule-1",
      status: "sent",
      providerMessageId: null,
      error: null,
      payload: { title: "Alert: latency", subject: "ignored" },
      createdAt,
    });
    expect(titled.title).toBe("Alert: latency");

    const subjectOnly = toNotificationLogDto({
      id: "log-2",
      orgId: "org-1",
      projectId: "proj-1",
      channelId: "ch-1",
      channelType: "email",
      incidentId: "inc-1",
      alertRuleId: "rule-1",
      status: "failed",
      providerMessageId: null,
      error: "timeout",
      payload: { subject: "Checkout P95 latency" },
      createdAt,
    });
    expect(subjectOnly.title).toBe("Checkout P95 latency");
    expect(subjectOnly.status).toBe("failed");
    expect(subjectOnly.createdAt).toBe("2026-10-27T10:00:00.000Z");
  });
});
