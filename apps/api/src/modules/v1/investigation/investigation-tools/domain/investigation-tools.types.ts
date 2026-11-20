export interface ToolScope {
  orgId: string;
  projectId: string;
}

export type EvidenceStatus = "available" | "empty" | "unavailable";

export interface EvidenceResult<T> {
  status: EvidenceStatus;
  observedAt: string;
  trust: "untrusted_telemetry";
  truncated: boolean;
  reason?: string;
  data: T | null;
}
