export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  key?: string;
}

export interface AlertRuleCondition {
  type: string;
  metric: string;
  operator: string;
  value?: number | string;
  window?: string;
  aggregation?: string;
  negate?: boolean;
  description?: string;
}

export interface AlertRule {
  id: string;
  orgId: string;
  projectId: string | null;
  name: string;
  description: string | null;
  conditions: AlertRuleCondition[];
  minSeverity: string;
  channelIds: string[];
  status: string;
  dedupeWindowSeconds: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AlertRuleInput {
  name: string;
  description?: string;
  conditions: AlertRuleCondition[];
  minSeverity: string;
  channelIds: string[];
  status?: string;
  dedupeWindowSeconds: number;
}

export interface NotificationChannel {
  id: string;
  orgId: string;
  projectId: string;
  name: string;
  type: string;
  fromEmail: string | null;
  fromName: string | null;
  recipientEmails: string[];
  slackChannelId: string | null;
  slackUserId: string | null;
  webhookUrl: string | null;
  webhookTypes: string[];
  isActive: boolean;
  createdAt: string;
}

export interface NotificationLog {
  id: string;
  channelType: string;
  incidentId: string | null;
  alertRuleId: string | null;
  status: string;
  error: string | null;
  title: string | null;
  createdAt: string;
}

export interface NotificationLogPage {
  items: NotificationLog[];
  limit: number;
  offset: number;
  hasMore: boolean;
}
