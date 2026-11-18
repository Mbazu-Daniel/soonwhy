import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dbCalls, stepArgs, useFakeDb } from "../../../common/testing/fake-db";
import { NotificationDispatcher } from "./notification-dispatcher";

vi.mock("../../../common/db", async () => {
  const { delegatingDb } = await import("../../../common/testing/fake-db");
  return { db: delegatingDb };
});

const NOW = new Date("2026-11-17T12:00:00.000Z");

function build() {
  const email = { send: vi.fn().mockResolvedValue({ ok: true }) };
  const slack = { sendTo: vi.fn().mockResolvedValue({ ok: true, providerMessageId: "ts-1" }) };
  const webhook = { send: vi.fn().mockResolvedValue({ ok: true }) };
  return { email, slack, webhook, dispatcher: new NotificationDispatcher(email as never, slack as never, webhook as never) };
}

function rule(overrides: Record<string, unknown> = {}) {
  return { id: "rule-1", minSeverity: "low", channelIds: ["ch-email"], ...overrides };
}

function channel(overrides: Record<string, unknown> = {}) {
  return {
    id: "ch-email",
    type: "email",
    recipientEmails: ["oncall@example.com"],
    webhookUrl: null,
    webhookSecret: null,
    slackAccessToken: null,
    slackChannelId: null,
    slackUserId: null,
    ...overrides,
  };
}

const ALERT = {
  orgId: "org-1",
  projectId: "project-1",
  incidentId: "inc-1",
  severity: "high" as const,
  title: "p95 above 500ms",
  body: "checkout is slow",
};

function loggedRows(): Record<string, unknown>[] {
  return dbCalls("insert")
    .map((call) => stepArgs(call, "values")?.[0] as Record<string, unknown>)
    .filter((row) => row && "idempotencyKey" in row);
}

describe("NotificationDispatcher.dispatchAlert", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    useFakeDb();
  });

  it("sends nothing when the project has no active rule", async () => {
    useFakeDb({ select: [[]] });
    const { dispatcher, email } = build();
    await expect(dispatcher.dispatchAlert(ALERT)).resolves.toEqual({ sent: 0, failed: 0, results: [] });
    expect(email.send).not.toHaveBeenCalled();
    expect(dbCalls("insert")).toHaveLength(0);
  });

  it("ignores a rule whose minimum severity is above the alert", async () => {
    useFakeDb({ select: [[rule({ minSeverity: "critical" })]] });
    const { dispatcher, email } = build();
    await expect(dispatcher.dispatchAlert(ALERT)).resolves.toEqual({ sent: 0, failed: 0, results: [] });
    expect(email.send).not.toHaveBeenCalled();
  });

  it("uses a rule whose minimum severity equals the alert", async () => {
    useFakeDb({ select: [[rule({ minSeverity: "high" })], [channel()], []] });
    const { dispatcher, email } = build();
    const result = await dispatcher.dispatchAlert(ALERT);
    expect(result.sent).toBe(1);
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it("emails the channel recipients and logs a sent delivery with a per incident key", async () => {
    useFakeDb({ select: [[rule()], [channel()], []] });
    const { dispatcher, email } = build();
    const result = await dispatcher.dispatchAlert({ ...ALERT, htmlBody: "<b>slow</b>", metadata: { env: "prod" } });
    expect(result).toEqual({ sent: 1, failed: 0, results: [{ channelId: "ch-email", channelType: "email", ok: true }] });
    expect(email.send).toHaveBeenCalledWith({
      to: ["oncall@example.com"],
      subject: "p95 above 500ms",
      body: "checkout is slow",
      htmlBody: "<b>slow</b>",
      metadata: { incidentId: "inc-1", severity: "high", env: "prod" },
    });
    expect(loggedRows()).toEqual([
      expect.objectContaining({
        orgId: "org-1",
        projectId: "project-1",
        channelId: "ch-email",
        channelType: "email",
        incidentId: "inc-1",
        alertRuleId: "rule-1",
        status: "sent",
        error: null,
        idempotencyKey: "inc-1:ch-email",
        attempts: "1",
        nextAttemptAt: null,
      }),
    ]);
  });

  it("records a timeline event naming the number of channels", async () => {
    useFakeDb({ select: [[rule()], [channel()], []] });
    const { dispatcher } = build();
    await dispatcher.dispatchAlert(ALERT);
    const timeline = dbCalls("insert")
      .map((call) => stepArgs(call, "values")?.[0] as Record<string, unknown>)
      .find((row) => row.type === "notification_sent");
    expect(timeline).toMatchObject({ incidentId: "inc-1", message: "Alert dispatched to 1 channel(s)" });
  });

  it("sends a channel shared by two rules only once", async () => {
    useFakeDb({ select: [[rule({ id: "r1" }), rule({ id: "r2" })], [channel()], []] });
    const { dispatcher, email } = build();
    const result = await dispatcher.dispatchAlert(ALERT);
    expect(result.results).toHaveLength(1);
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(loggedRows()[0]).toMatchObject({ alertRuleId: "r1" });
  });

  it("skips a channel that is inactive or deleted", async () => {
    useFakeDb({ select: [[rule({ channelIds: ["ch-gone"] })], [channel()]] });
    const { dispatcher, email } = build();
    const result = await dispatcher.dispatchAlert(ALERT);
    expect(result).toEqual({ sent: 0, failed: 0, results: [] });
    expect(email.send).not.toHaveBeenCalled();
  });

  it("posts to a slack channel with the bot token and channel id", async () => {
    const slackChannel = channel({ id: "ch-slack", type: "slack", slackAccessToken: "xoxb-1", slackChannelId: "C1", slackUserId: "U1" });
    useFakeDb({ select: [[rule({ channelIds: ["ch-slack"] })], [slackChannel], []] });
    const { dispatcher, slack } = build();
    await dispatcher.dispatchAlert(ALERT);
    expect(slack.sendTo).toHaveBeenCalledWith("xoxb-1", "C1", expect.objectContaining({ subject: "p95 above 500ms" }));
    expect(loggedRows()[0]).toMatchObject({ providerMessageId: "ts-1", channelType: "slack" });
  });

  it("falls back to the slack user when there is no channel id", async () => {
    const slackChannel = channel({ id: "ch-slack", type: "slack", slackAccessToken: "xoxb-1", slackChannelId: "", slackUserId: "U1" });
    useFakeDb({ select: [[rule({ channelIds: ["ch-slack"] })], [slackChannel], []] });
    const { dispatcher, slack } = build();
    await dispatcher.dispatchAlert(ALERT);
    expect(slack.sendTo).toHaveBeenCalledWith("xoxb-1", "U1", expect.anything());
  });

  it("posts to a webhook with its url, secret and an event id from the dedupe key", async () => {
    const hook = channel({ id: "ch-hook", type: "webhook", webhookUrl: "https://hooks.example.com/x", webhookSecret: "shh" });
    useFakeDb({ select: [[rule({ channelIds: ["ch-hook"] })], [hook], []] });
    const { dispatcher, webhook } = build();
    await dispatcher.dispatchAlert(ALERT);
    expect(webhook.send).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://hooks.example.com/x", secret: "shh", eventType: "alert.triggered", eventId: "inc-1:ch-hook" }),
    );
  });

  it("logs a failed delivery with the error and schedules the next attempt two minutes out", async () => {
    useFakeDb({ select: [[rule()], [channel()], []] });
    const { dispatcher, email } = build();
    email.send.mockResolvedValue({ ok: false, error: "domain not verified" });
    const result = await dispatcher.dispatchAlert(ALERT);
    expect(result).toEqual({ sent: 0, failed: 1, results: [{ channelId: "ch-email", channelType: "email", ok: false, error: "domain not verified" }] });
    expect(loggedRows()[0]).toMatchObject({
      status: "failed",
      error: "domain not verified",
      attempts: "1",
      nextAttemptAt: new Date(NOW.getTime() + 2 * 60_000),
    });
  });

  it("turns a throwing channel into a failed delivery and keeps going", async () => {
    const second = channel({ id: "ch-hook", type: "webhook", webhookUrl: "https://hooks.example.com/x" });
    useFakeDb({ select: [[rule({ channelIds: ["ch-email", "ch-hook"] })], [channel(), second], [], []] });
    const { dispatcher, email, webhook } = build();
    email.send.mockRejectedValue(new Error("smtp down"));
    const result = await dispatcher.dispatchAlert(ALERT);
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.results[0]).toMatchObject({ channelId: "ch-email", ok: false, error: "smtp down" });
    expect(webhook.send).toHaveBeenCalledTimes(1);
  });

  it("does not send again for an incident and channel already delivered", async () => {
    useFakeDb({ select: [[rule()], [channel()], [{ id: "log-1", status: "sent" }]] });
    const { dispatcher, email } = build();
    const result = await dispatcher.dispatchAlert(ALERT);
    expect(result).toEqual({ sent: 1, failed: 0, results: [{ channelId: "ch-email", channelType: "email", ok: true, error: undefined }] });
    expect(email.send).not.toHaveBeenCalled();
    expect(loggedRows()).toHaveLength(0);
  });

  it("leaves an earlier failed delivery to the retry job instead of sending again", async () => {
    useFakeDb({ select: [[rule()], [channel()], [{ id: "log-1", status: "failed" }]] });
    const { dispatcher, email } = build();
    const result = await dispatcher.dispatchAlert(ALERT);
    expect(result.failed).toBe(1);
    expect(result.results[0]?.error).toBe("duplicate dispatch blocked");
    expect(email.send).not.toHaveBeenCalled();
  });

  it("refuses a channel type it does not support", async () => {
    useFakeDb({ select: [[rule({ channelIds: ["ch-pager"] })], [channel({ id: "ch-pager", type: "pager" })], []] });
    const { dispatcher } = build();
    const result = await dispatcher.dispatchAlert(ALERT);
    expect(result.results[0]).toMatchObject({ ok: false, error: "Unsupported channel type: pager" });
  });
});

function failedLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "log-1",
    channelId: "ch-email",
    attempts: "1",
    providerMessageId: null,
    payload: { subject: "Original", body: "original body", htmlBody: "<i>x</i>", metadata: { incidentId: "inc-1", count: 3 } },
    ...overrides,
  };
}

function updates(): Record<string, unknown>[] {
  return dbCalls("update").map((call) => stepArgs(call, "set")?.[0] as Record<string, unknown>);
}

describe("NotificationDispatcher.retryFailedNotifications", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    useFakeDb();
  });

  it("does nothing when no failed notification is due", async () => {
    useFakeDb({ select: [[]] });
    const { dispatcher } = build();
    await expect(dispatcher.retryFailedNotifications()).resolves.toEqual({ processed: 0, succeeded: 0, permanentlyFailed: 0 });
    expect(dbCalls("update")).toHaveLength(0);
  });

  it("skips a notification another worker has already leased", async () => {
    useFakeDb({ select: [[failedLog()]], update: [[]] });
    const { dispatcher, email } = build();
    await expect(dispatcher.retryFailedNotifications()).resolves.toEqual({ processed: 0, succeeded: 0, permanentlyFailed: 0 });
    expect(email.send).not.toHaveBeenCalled();
    expect(dbCalls("update")).toHaveLength(1);
  });

  it("leases a notification for five minutes before sending", async () => {
    useFakeDb({ select: [[failedLog()], [channel()]], update: [[{ id: "log-1" }], []] });
    const { dispatcher } = build();
    await dispatcher.retryFailedNotifications();
    expect(updates()[0]).toMatchObject({ leasedUntil: new Date(NOW.getTime() + 5 * 60_000) });
  });

  it("resends the stored payload and marks the notification sent", async () => {
    useFakeDb({ select: [[failedLog({ attempts: "2" })], [channel()]], update: [[{ id: "log-1" }], []] });
    const { dispatcher, email } = build();
    email.send.mockResolvedValue({ ok: true, providerMessageId: "msg-9" });
    await expect(dispatcher.retryFailedNotifications()).resolves.toEqual({ processed: 1, succeeded: 1, permanentlyFailed: 0 });
    expect(email.send).toHaveBeenCalledWith({
      to: ["oncall@example.com"],
      subject: "Original",
      body: "original body",
      htmlBody: "<i>x</i>",
      metadata: { incidentId: "inc-1", count: "3" },
    });
    expect(updates()[1]).toMatchObject({
      status: "sent",
      attempts: "3",
      nextAttemptAt: null,
      leasedUntil: null,
      providerMessageId: "msg-9",
      error: null,
    });
  });

  it("sends a webhook retry with the alert.retry event", async () => {
    const hook = channel({ id: "ch-hook", type: "webhook", webhookUrl: "https://hooks.example.com/x", webhookSecret: "shh" });
    useFakeDb({ select: [[failedLog({ channelId: "ch-hook" })], [hook]], update: [[{ id: "log-1" }], []] });
    const { dispatcher, webhook } = build();
    await dispatcher.retryFailedNotifications();
    expect(webhook.send).toHaveBeenCalledWith(expect.objectContaining({ url: "https://hooks.example.com/x", secret: "shh", eventType: "alert.retry" }));
  });

  it("backs off exponentially after another failure and keeps the error", async () => {
    useFakeDb({ select: [[failedLog({ attempts: "3" })], [channel()]], update: [[{ id: "log-1" }], []] });
    const { dispatcher, email } = build();
    email.send.mockResolvedValue({ ok: false, error: "still down" });
    await expect(dispatcher.retryFailedNotifications()).resolves.toEqual({ processed: 1, succeeded: 0, permanentlyFailed: 0 });
    expect(updates()[1]).toMatchObject({
      status: "failed",
      attempts: "4",
      error: "still down",
      nextAttemptAt: new Date(NOW.getTime() + 16 * 60_000),
      leasedUntil: null,
    });
  });

  it("gives up after ten attempts without sending", async () => {
    useFakeDb({ select: [[failedLog({ attempts: "10" })]], update: [[{ id: "log-1" }], []] });
    const { dispatcher, email } = build();
    await expect(dispatcher.retryFailedNotifications()).resolves.toEqual({ processed: 1, succeeded: 0, permanentlyFailed: 1 });
    expect(email.send).not.toHaveBeenCalled();
    expect(updates()[1]).toMatchObject({ status: "failed", permanentFailure: "Max retry attempts (10) exceeded", nextAttemptAt: null, leasedUntil: null });
  });

  it("gives up when the channel no longer exists", async () => {
    useFakeDb({ select: [[failedLog()], []], update: [[{ id: "log-1" }], []] });
    const { dispatcher, email } = build();
    await expect(dispatcher.retryFailedNotifications()).resolves.toEqual({ processed: 1, succeeded: 0, permanentlyFailed: 1 });
    expect(email.send).not.toHaveBeenCalled();
    expect(updates()[1]).toMatchObject({ permanentFailure: "Channel not found" });
  });

  it("retries with a default subject and empty metadata when the stored payload is unusable", async () => {
    useFakeDb({ select: [[failedLog({ payload: "garbage" })], [channel()]], update: [[{ id: "log-1" }], []] });
    const { dispatcher, email } = build();
    await dispatcher.retryFailedNotifications();
    expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ subject: "Retry Notification", body: "", metadata: {} }));
  });
});
