import type { LlmCredentialSource } from "../../../../../common/db/schema";

export interface CreateRcaAnalysisInput {
  orgId: string;
  projectId: string;
  findingId: string;
  serviceName: string;
  severity: string;
  summary: string;
  rootCause: string;
  contributingFactors: string[];
  investigationSteps: string[];
  suggestedChanges: string[];
  evidenceRefs: string[];
  limitations: string[];
  confidence: string;
  evidenceSnapshot: Record<string, unknown>;
  provider: string;
  model: string;
  promptVersion: string;
  credentialSource: LlmCredentialSource;
  trigger?: "manual" | "auto";
  evidenceHash?: string | null;
}
