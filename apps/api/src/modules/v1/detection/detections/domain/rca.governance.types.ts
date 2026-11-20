import type { LlmCredentialSource } from "../../../../../common/db/schema";

export type RcaInvocationStatus = "succeeded" | "failed";

export interface RcaInvocationRecord {
  id: string;
  orgId: string;
  projectId: string;
  findingId: string;
  status: RcaInvocationStatus;
  provider: string;
  model: string;
  promptVersion: string;
  requestDurationMs: number;
  retries: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  credentialSource: LlmCredentialSource | null;
  credentialId: string | null;
  errorCode?: string;
  createdAt: Date;
}

export interface RcaGovernanceSink {
  recordSuccess(
    input: Omit<RcaInvocationRecord, "status" | "createdAt" | "errorCode">,
  ): Promise<void>;
  recordFailure(
    input: Omit<RcaInvocationRecord, "status" | "createdAt"> & {
      errorCode?: string;
    },
  ): Promise<void>;
}
