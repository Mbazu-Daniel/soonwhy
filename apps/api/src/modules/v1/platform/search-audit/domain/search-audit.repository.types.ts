export interface SearchAuditEntry {
  orgId: string;
  projectId: string;
  userId: string | null;
  actor: string;
  action: string;
  params: Record<string, string>;
}
