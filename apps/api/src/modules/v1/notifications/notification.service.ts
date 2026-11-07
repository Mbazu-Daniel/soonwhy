import { Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../../common/db";
import {
  notificationChannels,
  alertRules,
  webhookEndpoints,
  notificationLogs,
  incidentTimelineEvents,
  incidentOwnership,
  type NotificationChannelType,
  type AlertRuleSeverity,
} from "../../../common/db/schema";
import type { AlertRuleCondition } from "./alert-engine/alert-rule-conditions";
import { EmailChannel } from "./channels/email.channel";
import { SlackChannel } from "./channels/slack.channel";
import { WebhookChannel } from "./channels/webhook.channel";
import {
  toChannelDto,
  toAlertRuleDto,
  toWebhookEndpointDto,
  toTimelineEventDto,
  toOwnershipDto,
  toNotificationLogDto,
  type AlertRuleDto,
  type NotificationLogDto,
  type IncidentOwnershipDto,
  type IncidentTimelineEventDto,
  type NotificationChannelDto,
  type WebhookEndpointDto,
} from "./dto/notification.dto";

type ChannelRecord = typeof notificationChannels.$inferSelect;

type DispatchInput = {
  orgId: string;
  projectId: string;
  incidentId: string;
  severity: AlertRuleSeverity;
  title: string;
  body: string;
  htmlBody?: string;
  metadata?: Record<string, string>;
};

type DispatchResult = { sent: number; failed: number; results: { channelId: string; channelType: string; ok: boolean; error?: string }[] };

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
};

@Injectable()
export class NotificationService {
  private readonly channels = new Map<NotificationChannelType, EmailChannel | SlackChannel | WebhookChannel>();

  constructor(
    private readonly emailChannel: EmailChannel,
    private readonly slackChannel: SlackChannel,
    private readonly webhookChannel: WebhookChannel,
  ) {
    this.channels.set("email", this.emailChannel);
    this.channels.set("slack", this.slackChannel);
    this.channels.set("webhook", this.webhookChannel);
  }

  async listChannels(
    orgId: string,
    projectId: string,
  ): Promise<NotificationChannelDto[]> {
    const rows = await db
      .select()
      .from(notificationChannels)
      .where(
        and(
          eq(notificationChannels.orgId, orgId),
          eq(notificationChannels.projectId, projectId),
        ),
      );
    return rows.map(toChannelDto);
  }

  async getChannel(
    orgId: string,
    projectId: string,
    channelId: string,
  ): Promise<NotificationChannelDto | undefined> {
    const [row] = await db
      .select()
      .from(notificationChannels)
      .where(
        and(
          eq(notificationChannels.id, channelId),
          eq(notificationChannels.orgId, orgId),
          eq(notificationChannels.projectId, projectId),
        ),
      );
    return row ? toChannelDto(row) : undefined;
  }

  async createChannel(
    orgId: string,
    projectId: string,
    input: Omit<
      ChannelRecord,
      "id" | "orgId" | "projectId" | "createdAt" | "updatedAt"
    >,
  ): Promise<NotificationChannelDto> {
    const [row] = await db
      .insert(notificationChannels)
      .values({
        orgId,
        projectId,
        name: input.name,
        type: input.type,
        fromEmail: input.fromEmail ?? null,
        fromName: input.fromName ?? null,
        recipientEmails: input.recipientEmails ?? [],
        slackAccessToken: input.slackAccessToken ?? null,
        slackChannelId: input.slackChannelId ?? null,
        slackUserId: input.slackUserId ?? null,
        slackConnectedAt: input.slackConnectedAt ?? null,
        webhookUrl: input.webhookUrl ?? null,
        webhookSecret: input.webhookSecret ?? null,
        webhookTypes: input.webhookTypes ?? [],
        isActive: input.isActive ?? true,
      })
      .returning();
    return toChannelDto(row!);
  }

  async updateChannel(
    orgId: string,
    projectId: string,
    channelId: string,
    input: Partial<
      Pick<
        ChannelRecord,
        | "name"
        | "isActive"
        | "recipientEmails"
        | "slackChannelId"
        | "slackUserId"
        | "webhookUrl"
        | "webhookSecret"
        | "webhookTypes"
      >
    >,
  ): Promise<NotificationChannelDto> {
    const [row] = await db
      .update(notificationChannels)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          eq(notificationChannels.id, channelId),
          eq(notificationChannels.orgId, orgId),
          eq(notificationChannels.projectId, projectId),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Channel not found");
    return toChannelDto(row);
  }

  async deleteChannel(
    orgId: string,
    projectId: string,
    channelId: string,
  ): Promise<void> {
    await db
      .delete(notificationChannels)
      .where(
        and(
          eq(notificationChannels.id, channelId),
          eq(notificationChannels.orgId, orgId),
          eq(notificationChannels.projectId, projectId),
        ),
      );
  }

  async listAlertRules(
    orgId: string,
    projectId: string,
  ): Promise<AlertRuleDto[]> {
    const rows = await db
      .select()
      .from(alertRules)
      .where(
        and(eq(alertRules.orgId, orgId), eq(alertRules.projectId, projectId)),
      );
    return rows.map(toAlertRuleDto);
  }

  async createAlertRule(
    orgId: string,
    projectId: string,
    input: Omit<
      typeof alertRules.$inferSelect,
      "id" | "orgId" | "projectId" | "createdAt" | "updatedAt"
    >,
  ): Promise<AlertRuleDto> {
    const [row] = await db
      .insert(alertRules)
      .values({
        orgId,
        projectId,
        name: input.name,
        description: input.description ?? null,
        conditions: input.conditions ?? [],
        minSeverity: input.minSeverity,
        channelIds: input.channelIds ?? [],
        status: input.status ?? "active",
        dedupeWindowSeconds: input.dedupeWindowSeconds ?? 300,
      })
      .returning();
    return toAlertRuleDto(row!);
  }

  async updateAlertRule(
    orgId: string,
    projectId: string,
    ruleId: string,
    input: Partial<
      Pick<
        typeof alertRules.$inferSelect,
        | "name"
        | "description"
        | "conditions"
        | "minSeverity"
        | "channelIds"
        | "status"
        | "dedupeWindowSeconds"
      >
    >,
  ): Promise<AlertRuleDto> {
    const [row] = await db
      .update(alertRules)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          eq(alertRules.id, ruleId),
          eq(alertRules.orgId, orgId),
          eq(alertRules.projectId, projectId),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Alert rule not found");
    return toAlertRuleDto(row);
  }

  async deleteAlertRule(
    orgId: string,
    projectId: string,
    ruleId: string,
  ): Promise<void> {
    await db
      .delete(alertRules)
      .where(
        and(
          eq(alertRules.id, ruleId),
          eq(alertRules.orgId, orgId),
          eq(alertRules.projectId, projectId),
        ),
      );
  }

  async listNotificationLogs(
    orgId: string,
    projectId: string,
    paging: { limit: number; offset: number },
  ): Promise<{
    items: NotificationLogDto[];
    limit: number;
    offset: number;
    hasMore: boolean;
  }> {
    const rows = await db
      .select()
      .from(notificationLogs)
      .where(
        and(
          eq(notificationLogs.orgId, orgId),
          eq(notificationLogs.projectId, projectId),
        ),
      )
      .orderBy(desc(notificationLogs.createdAt))
      .limit(paging.limit + 1)
      .offset(paging.offset);
    const hasMore = rows.length > paging.limit;
    return {
      items: rows.slice(0, paging.limit).map(toNotificationLogDto),
      limit: paging.limit,
      offset: paging.offset,
      hasMore,
    };
  }

  async listOrgAlertRules(orgId: string): Promise<AlertRuleDto[]> {
    const rows = await db
      .select()
      .from(alertRules)
      .where(and(eq(alertRules.orgId, orgId), isNull(alertRules.projectId)));
    return rows.map(toAlertRuleDto);
  }

  async createOrgAlertRule(
    orgId: string,
    input: Omit<
      typeof alertRules.$inferSelect,
      "id" | "orgId" | "projectId" | "createdAt" | "updatedAt"
    >,
  ): Promise<AlertRuleDto> {
    const [row] = await db
      .insert(alertRules)
      .values({
        orgId,
        projectId: null,
        name: input.name,
        description: input.description ?? null,
        conditions: input.conditions ?? [],
        minSeverity: input.minSeverity,
        channelIds: input.channelIds ?? [],
        status: input.status ?? "active",
        dedupeWindowSeconds: input.dedupeWindowSeconds ?? 300,
      })
      .returning();
    return toAlertRuleDto(row!);
  }

  async updateOrgAlertRule(
    orgId: string,
    ruleId: string,
    input: Partial<
      Pick<
        typeof alertRules.$inferSelect,
        | "name"
        | "description"
        | "conditions"
        | "minSeverity"
        | "channelIds"
        | "status"
        | "dedupeWindowSeconds"
      >
    >,
  ): Promise<AlertRuleDto> {
    const [row] = await db
      .update(alertRules)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          eq(alertRules.id, ruleId),
          eq(alertRules.orgId, orgId),
          isNull(alertRules.projectId),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Alert rule not found");
    return toAlertRuleDto(row);
  }

  async deleteOrgAlertRule(orgId: string, ruleId: string): Promise<void> {
    await db
      .delete(alertRules)
      .where(
        and(
          eq(alertRules.id, ruleId),
          eq(alertRules.orgId, orgId),
          isNull(alertRules.projectId),
        ),
      );
  }

  async listWebhookEndpoints(
    orgId: string,
    projectId: string,
  ): Promise<WebhookEndpointDto[]> {
    const rows = await db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.orgId, orgId),
          eq(webhookEndpoints.projectId, projectId),
        ),
      );
    return rows.map(toWebhookEndpointDto);
  }

  async createWebhookEndpoint(
    orgId: string,
    projectId: string,
    input: Omit<
      typeof webhookEndpoints.$inferSelect,
      | "id"
      | "orgId"
      | "projectId"
      | "createdAt"
      | "updatedAt"
      | "lastTriggeredAt"
    >,
  ): Promise<WebhookEndpointDto> {
    const [row] = await db
      .insert(webhookEndpoints)
      .values({
        orgId,
        projectId,
        name: input.name,
        url: input.url,
        secret: input.secret ?? null,
        types: input.types ?? [],
        isActive: true,
      })
      .returning();
    return toWebhookEndpointDto(row!);
  }

  async updateWebhookEndpoint(
    orgId: string,
    projectId: string,
    endpointId: string,
    input: Partial<
      Pick<
        typeof webhookEndpoints.$inferSelect,
        "name" | "url" | "secret" | "types" | "isActive"
      >
    >,
  ): Promise<WebhookEndpointDto> {
    const [row] = await db
      .update(webhookEndpoints)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          eq(webhookEndpoints.id, endpointId),
          eq(webhookEndpoints.orgId, orgId),
          eq(webhookEndpoints.projectId, projectId),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Webhook endpoint not found");
    return toWebhookEndpointDto(row);
  }

  async deleteWebhookEndpoint(
    orgId: string,
    projectId: string,
    endpointId: string,
  ): Promise<void> {
    await db
      .delete(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, endpointId),
          eq(webhookEndpoints.orgId, orgId),
          eq(webhookEndpoints.projectId, projectId),
        ),
      );
  }

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
      const result = await this.sendToChannel(channel, {
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

      await this.logDelivery({
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
      });

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

  async listTimelineEvents(
    orgId: string,
    projectId: string,
    incidentId: string,
  ): Promise<IncidentTimelineEventDto[]> {
    const rows = await db
      .select()
      .from(incidentTimelineEvents)
      .where(
        and(
          eq(incidentTimelineEvents.incidentId, incidentId),
          eq(incidentTimelineEvents.orgId, orgId),
          eq(incidentTimelineEvents.projectId, projectId),
        ),
      )
      .orderBy(desc(incidentTimelineEvents.createdAt));
    return rows.map(toTimelineEventDto);
  }

  async assignOwner(
    orgId: string,
    projectId: string,
    incidentId: string,
    ownerId: string,
    ownerName: string,
    assignedBy?: string,
    assignedByName?: string,
  ): Promise<IncidentOwnershipDto> {
    const [existing] = await db
      .select()
      .from(incidentOwnership)
      .where(eq(incidentOwnership.incidentId, incidentId));

    if (existing) {
      const [row] = await db
        .update(incidentOwnership)
        .set({
          ownerId,
          ownerName,
          assignedBy,
          assignedByName,
          assignedAt: new Date(),
        })
        .where(eq(incidentOwnership.incidentId, incidentId))
        .returning();
      return toOwnershipDto(row!);
    }

    const [row] = await db
      .insert(incidentOwnership)
      .values({
        orgId,
        projectId,
        incidentId,
        ownerId,
        ownerName,
        assignedBy,
        assignedByName,
      })
      .returning();
    return toOwnershipDto(row!);
  }

  async getOwner(
    orgId: string,
    projectId: string,
    incidentId: string,
  ): Promise<IncidentOwnershipDto | undefined> {
    const [row] = await db
      .select()
      .from(incidentOwnership)
      .where(
        and(
          eq(incidentOwnership.incidentId, incidentId),
          eq(incidentOwnership.orgId, orgId),
          eq(incidentOwnership.projectId, projectId),
        ),
      );
    return row ? toOwnershipDto(row) : undefined;
  }

  private async sendToChannel(
    channel: ChannelRecord,
    input: ChannelInput,
  ) {
    const adapter = this.channels.get(channel.type);
    if (!adapter)
      return { ok: false, error: `Unknown channel type: ${channel.type}` };

    if (channel.type === "email") {
      return (adapter as EmailChannel).send({
        to: input.to,
        subject: input.subject,
        body: input.body,
        htmlBody: input.htmlBody,
        metadata: input.metadata,
      });
    }

    if (channel.type === "slack") {
      return (adapter as SlackChannel).sendTo(input.botToken!, input.channelId!, {
        to: input.to,
        subject: input.subject,
        body: input.body,
        htmlBody: input.htmlBody,
        metadata: input.metadata,
      });
    }

    if (channel.type === "webhook") {
      return adapter.send({
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

  private async logDelivery(input: DeliveryLog) {
    await db.insert(notificationLogs).values({
      orgId: input.orgId,
      projectId: input.projectId,
      channelId: input.channel.id,
      channelType: input.channel.type,
      incidentId: input.incidentId,
      alertRuleId: input.alertRuleId,
      status: input.result.ok ? "sent" : "failed",
      providerMessageId: input.result.providerMessageId ?? null,
      error: input.result.error ?? null,
      payload: input.payload,
    });
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
