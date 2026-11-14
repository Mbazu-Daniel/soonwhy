import type { DetectionFinding } from "./detection.types";
import type { LlmCredentialSource } from "../../../common/db/schema";
import type { RankedCandidate, ScoringWeights } from "./root-cause/root-cause.types";

export type RcaConfidence = "low" | "medium" | "high";

export interface RcaEvidenceItem {
  id: string;
  sourceFindingId: string;
  type: DetectionFinding["type"];
  severity: DetectionFinding["severity"];
  label: string;
  value: number | string;
  context?: Record<string, unknown>;
}

export interface RcaEvidence {
  projectId: string;
  serviceName: string;
  severity: DetectionFinding["severity"];
  window: {
    start: Date;
    end: Date;
  };
  primaryFinding: RcaEvidenceItem;
  supportingFindings: RcaEvidenceItem[];
  traces: RcaEvidenceItem[];
  recommendations: RcaEvidenceItem[];
  rankedCandidates?: RankedCandidate[];
  rankingWeights?: ScoringWeights;
  evidenceCoverage?: number;
  rankingLimitations?: string[];
}

export interface RcaAnalysis {
  summary: string;
  rootCause: string;
  contributingFactors: string[];
  investigationSteps: string[];
  suggestedChanges: string[];
  evidenceRefs: string[];
  confidence: RcaConfidence;
  limitations: string[];
}

export interface RcaUsage {
  requestDurationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  retries: number;
}

export interface RcaProviderResult {
  analysis: RcaAnalysis;
  usage: RcaUsage;
  promptVersion: string;
}

export interface RcaCredentialInfo {
  readonly source: LlmCredentialSource;
  readonly providerId: string;
  readonly model: string;
  readonly credentialId: string | null;
}

export interface RcaAnalysisOutcome extends RcaProviderResult {
  credential: RcaCredentialInfo;
  evidence: RcaEvidence;
}
