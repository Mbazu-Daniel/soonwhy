export type AuditEventInput = {
  userId?: string;
  organizationId?: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};
