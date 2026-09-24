import { db } from './db';
import { agentAuditEvents } from './db/schema';

export type AgentAuditEventInput = {
  orgId: string;
  userId?: string;
  investigationId?: string;
  eventType: string;
  toolName?: string;
  model?: string;
  status: string;
  tokens?: number;
  costUsd?: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function recordAgentAuditEvent(input: AgentAuditEventInput) {
  const [event] = await db.insert(agentAuditEvents).values(input).returning();
  if (!event) throw new Error('Failed to record agent audit event');
  return event;
}
