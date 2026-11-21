export interface NotificationChannelDto {
  id: string;
  orgId: string;
  projectId: string;
  name: string;
  type: string;
  fromEmail: string | null;
  fromName: string | null;
  recipientEmails: string[];
  hasSlackToken: boolean;
  slackChannelId: string | null;
  slackUserId: string | null;
  slackConnectedAt: string | null;
  webhookUrl: string | null;
  hasWebhookSecret: boolean;
  webhookTypes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLogDto {
  id: string;
  orgId: string;
  projectId: string;
  channelId: string | null;
  channelType: string;
  incidentId: string | null;
  alertRuleId: string | null;
  status: string;
  providerMessageId: string | null;
  error: string | null;
  title: string | null;
  createdAt: string;
}

export interface AlertRuleDto {
  id: string;
  orgId: string;
  projectId: string | null;
  name: string;
  description: string | null;
  conditions: Array<{
    type: string;
    metric: string;
    operator: string;
    value?: number | string;
    window?: string;
    aggregation?: string;
    negate?: boolean;
    description?: string;
  }>;
  minSeverity: string;
  channelIds: string[];
  status: string;
  dedupeWindowSeconds: number;
  findingCategory: "error" | "performance" | "security" | "vulnerability" | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEndpointDto {
  id: string;
  orgId: string;
  projectId: string;
  name: string;
  url: string;
  hasSecret: boolean;
  types: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentTimelineEventDto {
  id: string;
  orgId: string;
  projectId: string;
  incidentId: string;
  type: string;
  actorName: string;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface IncidentOwnershipDto {
  id: string;
  orgId: string;
  projectId: string;
  incidentId: string;
  ownerId: string;
  ownerName: string;
  assignedBy: string | null;
  assignedByName: string | null;
  assignedAt: string;
}
