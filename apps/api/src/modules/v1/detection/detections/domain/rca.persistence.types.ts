import type { RcaAnalysis, RcaEvidence, RcaUsage } from "./rca.types";
import type { LlmCredentialSource } from "../../../../../common/db/schema";

export interface PersistRcaAnalysisInput {
  orgId: string;
  projectId: string;
  findingId: string;
  evidence: RcaEvidence;
  analysis: RcaAnalysis;
  provider: string;
  model: string;
  promptVersion: string;
  credentialSource: LlmCredentialSource;
  usage: RcaUsage;
  trigger?: "manual" | "auto";
  evidenceHash?: string | null;
}
