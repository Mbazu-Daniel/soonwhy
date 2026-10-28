import { db } from "./db";
import { auditLogs } from "./db/schema";

export type AuditEventInput = {
  userId?: string;
  organizationId?: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

export async function recordAuditEvent(input: AuditEventInput) {
  const [event] = await db
    .insert(auditLogs)
    .values({
      userId: input.userId ?? null,
      organizationId: input.organizationId ?? null,
      action: input.action,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();

  if (!event) throw new Error("Failed to record audit event");
  return event;
}
