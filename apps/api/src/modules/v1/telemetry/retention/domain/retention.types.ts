export interface CleanupPolicyResult {
  policyId: number;
  dataType: string;
  success: boolean;
  skipped: boolean;
  cutoffDate: string;
  error?: string;
}

export interface ExportResult {
  orgId: string;
  projectId: string;
  dataType: string;
  beforeDate: Date;
  status: "completed" | "failed";
  recordCount?: number;
  data?: unknown[];
  error?: string;
}
