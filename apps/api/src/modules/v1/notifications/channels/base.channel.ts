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
