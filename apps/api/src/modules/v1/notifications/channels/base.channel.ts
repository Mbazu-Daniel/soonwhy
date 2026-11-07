import type {
  NotificationChannelType,
  AlertRuleSeverity,
} from "../../../../common/db/schema";

export interface ChannelSendInput {
  to: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  metadata?: Record<string, string>;
}

export interface ChannelSendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export abstract class BaseChannel {
  abstract readonly type: NotificationChannelType;
  abstract send(input: ChannelSendInput): Promise<ChannelSendResult>;
}
