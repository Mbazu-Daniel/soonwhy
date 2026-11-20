import type { NotificationChannelDto, NotificationLogDto, AlertRuleDto, WebhookEndpointDto, IncidentTimelineEventDto, IncidentOwnershipDto } from "./notification.dto.types";

export function toChannelDto(row: {
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}): NotificationChannelDto {
  return {
    id: row.id as string,
    orgId: row.orgId as string,
    projectId: row.projectId as string,
    name: row.name as string,
    type: row.type as string,
    fromEmail: row.fromEmail as string | null,
    fromName: row.fromName as string | null,
    recipientEmails: (row.recipientEmails as string[]) ?? [],
    hasSlackToken: Boolean(row.slackAccessToken),
    slackChannelId: row.slackChannelId as string | null,
    slackUserId: row.slackUserId as string | null,
    slackConnectedAt: row.slackConnectedAt as string | null,
    webhookUrl: row.webhookUrl as string | null,
    hasWebhookSecret: Boolean(row.webhookSecret),
    webhookTypes: (row.webhookTypes as string[]) ?? [],
    isActive: Boolean(row.isActive),
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : String(row.updatedAt),
  };
}

export function toAlertRuleDto(row: {
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}): AlertRuleDto {
  return {
    id: row.id as string,
    orgId: row.orgId as string,
    projectId: (row.projectId as string | null) ?? null,
    name: row.name as string,
    description: row.description as string | null,
    conditions:
      (row.conditions as AlertRuleDto["conditions"]) ?? [],
    minSeverity: row.minSeverity as string,
    channelIds: (row.channelIds as string[]) ?? [],
    status: row.status as string,
    dedupeWindowSeconds: Number(row.dedupeWindowSeconds ?? 300),
    findingCategory: (row.findingCategory as AlertRuleDto["findingCategory"]) ?? null,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : String(row.updatedAt),
  };
}

export function toNotificationLogDto(row: {
  createdAt: Date;
  [key: string]: unknown;
}): NotificationLogDto {
  return {
    id: row.id as string,
    orgId: row.orgId as string,
    projectId: row.projectId as string,
    channelId: (row.channelId as string | null) ?? null,
    channelType: row.channelType as string,
    incidentId: (row.incidentId as string | null) ?? null,
    alertRuleId: (row.alertRuleId as string | null) ?? null,
    status: row.status as string,
    providerMessageId: (row.providerMessageId as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    title:
      payloadField(row.payload, "title") ??
      payloadField(row.payload, "subject"),
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

function payloadField(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export function toWebhookEndpointDto(row: {
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt: Date | null;
  [key: string]: unknown;
}): WebhookEndpointDto {
  return {
    id: row.id as string,
    orgId: row.orgId as string,
    projectId: row.projectId as string,
    name: row.name as string,
    url: row.url as string,
    hasSecret: Boolean(row.secret),
    types: (row.types as string[]) ?? [],
    isActive: Boolean(row.isActive),
    lastTriggeredAt:
      row.lastTriggeredAt instanceof Date
        ? row.lastTriggeredAt.toISOString()
        : (row.lastTriggeredAt ?? null),
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : String(row.updatedAt),
  };
}

export function toTimelineEventDto(row: {
  createdAt: Date;
  [key: string]: unknown;
}): IncidentTimelineEventDto {
  return {
    id: row.id as string,
    orgId: row.orgId as string,
    projectId: row.projectId as string,
    incidentId: row.incidentId as string,
    type: row.type as string,
    actorName: row.actorName as string,
    message: row.message as string,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

export function toOwnershipDto(row: {
  assignedAt: Date;
  [key: string]: unknown;
}): IncidentOwnershipDto {
  return {
    id: row.id as string,
    orgId: row.orgId as string,
    projectId: row.projectId as string,
    incidentId: row.incidentId as string,
    ownerId: row.ownerId as string,
    ownerName: row.ownerName as string,
    assignedBy: row.assignedBy as string | null,
    assignedByName: row.assignedByName as string | null,
    assignedAt:
      row.assignedAt instanceof Date
        ? row.assignedAt.toISOString()
        : String(row.assignedAt),
  };
}
