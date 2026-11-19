export interface WebhookDeliveryInput {
  url: string;
  secret?: string;
  payload: Record<string, unknown>;
  eventType: string;
  eventId?: string;
}

export interface WebhookDeliveryResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
}
