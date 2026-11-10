import { Injectable } from "@nestjs/common";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "../../../common/db";
import {
  alertRules,
  notificationChannels,
  notificationLogs,
  incidentTimelineEvents,
  type AlertRuleSeverity,
} from "../../../common/db/schema";
import { EmailChannel } from "./channels/email.channel";
import { SlackChannel } from "./channels/slack.channel";
import { WebhookChannel } from "./channels/webhook.channel";

export type DispatchInput = {
  orgId: string;
  projectId: string;
  incidentId: string;
  severity: AlertRuleSeverity;
  title: string;
  body: string;
  htmlBody?: string;
  metadata?: Record<string, string>;
};

export type DispatchResult = { sent: number; failed: number; results: { channelId: string; channelType: string; ok: boolean; error?: string }[] };

type ChannelInput = {
  to: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  metadata?: Record<string, string>;
  url?: string;
  secret?: string;
  eventType?: string;
  botToken?: string;
  channelId?: string;
};

type DeliveryLog = {
  orgId: string;
  projectId: string;
  channel: ChannelRecord;
  incidentId: string | undefined;
  alertRuleId: string | undefined;
  result: { ok: boolean; providerMessageId?: string; error?: string };
  payload: Record<string, string>;
  idempotencyKey?: string;
};

type ChannelRecord = typeof notificationChannels.$inferSelect;

@Injectable()
export class NotificationDispatcher {
  constructor(
    private readonly emailChannel: EmailChannel,
    private readonly slackChannel: SlackChannel,
    private readonly webhookChannel: WebhookChannel,
  ) {}

  async dispatchAlert(input: DispatchInput): Promise<DispatchResult> {
    const { orgId, projectId, incidentId, severity, title, body, htmlBody, metadata } = input;

    const rules = await db
      .select()
      .from(alertRules)
      .where(
        and(
          eq(alertRules.orgId, orgId),
          eq(alertRules.projectId, projectId),
          eq(alertRules.status, "active"),
        ),
      );

    const severityRank = rank(severity);
    const applicableRules = rules.filter(
      (rule) => rank(rule.minSeverity) <= severityRank,
    );

    const results: { channelId: string; channelType: string; ok: boolean; error?: string }[] = [];
    let sent = 0;
    let failed = 0;

    const channelIds = new Set<string>();
    for (const rule of applicableRules) {
      for (const cid of rule.channelIds ?? []) channelIds.add(cid);
    }

    if (channelIds.size === 0) {
      return { sent: 0, failed: 0, results: [] };
    }

    const channels = await db
      .select()
      .from(notificationChannels)
      .where(
        and(
          eq(notificationChannels.orgId, orgId),
          eq(notificationChannels.projectId, projectId),
          eq(notificationChannels.isActive, true),
        ),
      );

    const channelMap = new Map<string, ChannelRecord>();
    for (const ch of channels) channelMap.set(ch.id, ch);

    for (const channelId of channelIds) {
      const channel = channelMap.get(channelId);
      if (!channel) continue;

      const ruleId = ruleForChannel(applicableRules, channelId);

      const idempotencyKey = `${incidentId}:${channelId}`;

      let result;

      const [existing] = await db
        .select({ id: notificationLogs.id, status: notificationLogs.status })
        .from(notificationLogs)
        .where(eq(notificationLogs.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existing) {
        result = { ok: existing.status === "sent", error: existing.status === "sent" ? undefined : "duplicate dispatch blocked" };
      } else {
        try {
          result = await this.sendToChannel(channel, {
            to: channel.recipientEmails ?? [],
            subject: title,
            body,
            htmlBody,
            metadata: { incidentId, severity, ...metadata },
            ...(channel.type === "webhook"
              ? {
                  url: channel.webhookUrl!,
                  secret: channel.webhookSecret ?? undefined,
                  eventType: "alert.triggered",
                  eventId: idempotencyKey,
                }
              : {}),
            ...(channel.type === "slack"
              ? {
                  botToken: channel.slackAccessToken ?? undefined,
                  channelId:
                    channel.slackChannelId || channel.slackUserId || undefined,
                }
              : {}),
          });
        } catch (error) {
          result = { ok: false, error: error instanceof Error ? error.message : String(error) };
        }

        await this.logDeliveryWithOutbox({
          orgId,
          projectId,
          channel,
          incidentId,
          alertRuleId: ruleId,
          result,
          payload: {
            subject: title,
            body,
            htmlBody: htmlBody ?? "",
            ...metadata,
          },
          idempotencyKey,
        });
      }

      if (result.ok) sent++;
      else failed++;

      results.push({ channelId, channelType: channel.type, ...result });
    }

    await this.createTimelineEvent(
      orgId,
      projectId,
      incidentId,
      "notification_sent",
      "Soonwhy",
      `Alert dispatched to ${results.length} channel(s)`,
    );

    return { sent, failed, results };
  }

  async createTimelineEvent(
    orgId: string,
    projectId: string,
    incidentId: string,
    type:
      | "created"
      | "updated"
      | "resolved"
      | "reopened"
      | "assigned"
      | "unassigned"
      | "comment"
      | "notification_sent"
      | "severity_changed",
    actorName: string,
    message: string,
    metadata?: Record<string, string>,
  ) {
    await db.insert(incidentTimelineEvents).values({
      orgId,
      projectId,
      incidentId,
      type,
      actorName,
      message,
      metadata: metadata ?? null,
    });
  }
  async retryFailedNotifications(): Promise<{ processed: number; succeeded: number; permanentlyFailed: number }> {
    const now = new Date();
    const MAX_ATTEMPTS = 10;
    const LEASE_MS = 5 * 60_000;

    // Claim pending notifications that are due for retry
    const toRetry = await db
      .select()
      .from(notificationLogs)
      .where(
        and(
          eq(notificationLogs.status, "failed"),
          isNull(notificationLogs.permanentFailure),
          or(
            isNull(notificationLogs.nextAttemptAt),
            lt(notificationLogs.nextAttemptAt, now),
          ),
          // Not leased or lease expired
          or(
            isNull(notificationLogs.leasedUntil),
            lt(notificationLogs.leasedUntil, now),
          ),
        ),
      )
      .limit(100);

    let processed = 0;
    let succeeded = 0;
    let permanentlyFailed = 0;

    for (const log of toRetry) {
      const claimed = await db
        .update(notificationLogs)
        .set({
          leasedUntil: new Date(Date.now() + LEASE_MS),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(notificationLogs.id, log.id),
            or(
              isNull(notificationLogs.leasedUntil),
              lt(notificationLogs.leasedUntil, now),
            ),
          ),
        )
        .returning({ id: notificationLogs.id });

      if (claimed.length === 0) continue;

      processed++;
      const attempts = parseInt(log.attempts ?? "0", 10);

      if (attempts >= MAX_ATTEMPTS) {
        // Mark as permanently failed
        await db
          .update(notificationLogs)
          .set({
            permanentFailure: `Max retry attempts (${MAX_ATTEMPTS}) exceeded`,
            status: "failed",
            updatedAt: now,
          })
          .where(eq(notificationLogs.id, log.id));
        permanentlyFailed++;
        continue;
      }

      // Get channel info
      const [channel] = await db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.id, log.channelId!))
        .limit(1);

      if (!channel) {
        await db
          .update(notificationLogs)
          .set({
            permanentFailure: "Channel not found",
            status: "failed",
            updatedAt: now,
          })
          .where(eq(notificationLogs.id, log.id));
        permanentlyFailed++;
        continue;
      }

      // Retry sending
      const result = await this.sendToChannel(channel, {
        to: channel.recipientEmails ?? [],
        subject: (log.payload as any).subject || "Retry Notification",
        body: (log.payload as any).body || "",
        htmlBody: (log.payload as any).htmlBody,
        metadata: (log.payload as any).metadata || {},
        ...(channel.type === "webhook"
          ? {
              url: channel.webhookUrl!,
              secret: channel.webhookSecret ?? undefined,
              eventType: "alert.retry",
            }
          : {}),
        ...(channel.type === "slack"
          ? {
              botToken: channel.slackAccessToken ?? undefined,
              channelId: channel.slackChannelId || channel.slackUserId || undefined,
            }
          : {}),
      });

      const newAttempts = attempts + 1;
      const nextAttemptAt = result.ok 
        ? null 
        : new Date(Date.now() + Math.pow(2, newAttempts) * 60000);

      await db
        .update(notificationLogs)
        .set({
          status: result.ok ? "sent" : "failed",
          attempts: String(newAttempts),
          lastAttemptAt: now,
          nextAttemptAt,
          providerMessageId: result.providerMessageId ?? log.providerMessageId,
          error: result.error ?? null,
          updatedAt: now,
        })
        .where(eq(notificationLogs.id, log.id));

      if (result.ok) succeeded++;
    }

    return { processed, succeeded, permanentlyFailed };
  }

  private async logDeliveryWithOutbox(log: DeliveryLog & { idempotencyKey?: string }): Promise<void> {
    const { orgId, projectId, channel, incidentId, alertRuleId, result, payload, idempotencyKey } = log;

    const status = result.ok ? "sent" : "failed";
    const attempts = result.ok ? "0" : "1";
    const lastAttemptAt = new Date();

    // Calculate next attempt with exponential backoff if failed
    const nextAttemptAt = result.ok ? null : new Date(Date.now() + Math.pow(2, parseInt(attempts)) * 60000); // 2^n minutes

    // Generate idempotency key if not provided
    const finalIdempotencyKey = idempotencyKey ?? `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    await db.insert(notificationLogs).values({
      orgId,
      projectId,
      channelId: channel.id,
      channelType: channel.type,
      incidentId,
      alertRuleId,
      status,
      providerMessageId: result.providerMessageId ?? null,
      error: result.error ?? null,
      payload,
      idempotencyKey: finalIdempotencyKey,
      attempts,
      lastAttemptAt,
      nextAttemptAt,
      leasedUntil: null,
      permanentFailure: null,
    });
  }

  private async sendToChannel(
    channel: ChannelRecord,
    input: ChannelInput,
  ) {
    if (channel.type === "email") {
      return this.emailChannel.send({
        to: input.to,
        subject: input.subject,
        body: input.body,
        htmlBody: input.htmlBody,
        metadata: input.metadata,
      });
    }

    if (channel.type === "slack") {
      return this.slackChannel.sendTo(input.botToken!, input.channelId!, {
        to: input.to,
        subject: input.subject,
        body: input.body,
        htmlBody: input.htmlBody,
        metadata: input.metadata,
      });
    }

    if (channel.type === "webhook") {
      return this.webhookChannel.send({
        ...input,
        url: input.url!,
        secret: input.secret,
        eventType: input.eventType,
        to: input.to,
        subject: input.subject,
        body: input.body,
        htmlBody: input.htmlBody,
        metadata: input.metadata,
      });
    }

    return { ok: false, error: `Unsupported channel type: ${channel.type}` };
  }

}

function rank(severity: AlertRuleSeverity): number {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function ruleForChannel(rules: { channelIds: string[] | null; id: string }[], channelId: string): string | undefined {
  for (const rule of rules) {
    if (rule.channelIds && rule.channelIds.includes(channelId)) return rule.id;
  }
  return undefined;
}
