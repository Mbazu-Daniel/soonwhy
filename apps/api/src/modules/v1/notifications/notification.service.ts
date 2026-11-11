import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../../common/db";
import {
  notificationChannels,
  alertRules,
  webhookEndpoints,
  notificationLogs,
  incidentTimelineEvents,
  incidentOwnership,
  type AlertRuleStatus,
} from "../../../common/db/schema";
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
import {
  NotificationDispatcher,
  type DispatchInput,
  type DispatchResult,
} from "./notification-dispatcher";
export type { DispatchInput, DispatchResult } from "./notification-dispatcher";

type ChannelRecord = typeof notificationChannels.$inferSelect;

const ALERT_RULE_STATUSES = new Set<AlertRuleStatus>(["active", "disabled"]);

function assertAlertRuleInput(input: { status?: string | null }) {
  if (
    input.status !== undefined &&
    input.status !== null &&
    !ALERT_RULE_STATUSES.has(input.status as AlertRuleStatus)
  ) {
    throw new BadRequestException(
      `Invalid alert rule status: ${String(input.status)} (expected active | disabled)`,
    );
  }
}


@Injectable()
export class NotificationService {
  constructor(private readonly dispatcher: NotificationDispatcher) {}

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
    assertAlertRuleInput(input);
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
    assertAlertRuleInput(input);
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
    assertAlertRuleInput(input);
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
    assertAlertRuleInput(input);
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
  async dispatchAlert(input: DispatchInput): Promise<DispatchResult> {
    return this.dispatcher.dispatchAlert(input);
  }

  async retryFailedNotifications(): Promise<{
    processed: number;
    succeeded: number;
    permanentlyFailed: number;
  }> {
    return this.dispatcher.retryFailedNotifications();
  }
}
