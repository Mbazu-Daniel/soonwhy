import type { TelemetryIdentity } from "@soonwhy/shared";

export interface EvidenceBundle {
  findings: Finding[];
  correlations: CorrelationData[];
  graphPaths: GraphPathEvidence[];
  timeWindow: {
    start: string;
    end: string;
  };
}

export interface Finding {
  identity: TelemetryIdentity;
  findingType: string;
  severity: "info" | "warning" | "critical";
  evidence: string[];
  confidence: number;
  timestamp: string;
}

export interface CorrelationData {
  type: string;
  source: TelemetryIdentity;
  target: TelemetryIdentity;
  strength: number;
  metadata?: Record<string, unknown>;
}

export interface GraphPathEvidence {
  path: string[];
  totalStrength: number;
  nodes: TelemetryIdentity[];
}

export interface InvestigationRequest {
  projectId: string;
  evidenceBundle: EvidenceBundle;
  question?: string;
  modelConfig?: {
    provider?: string;
    model?: string;
    temperature?: number;
  };
}

export interface InvestigationResult {
  investigationId: string;
  summary: string;
  rootCause: RootCauseAnalysis;
  explanation: string;
  recommendations: string[];
  confidence: number;
  evidenceCitations: EvidenceCitation[];
  relatedFindings: string[];
  timestamp: string;
  modelUsed: string;
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
  costUsd?: number;
}

export interface RootCauseAnalysis {
  primaryCause: string;
  contributingFactors: string[];
  affectedComponents: string[];
  impactAssessment: {
    severity: "low" | "medium" | "high" | "critical";
    affectedUsers?: number;
    affectedEndpoints?: string[];
  };
}

export interface EvidenceCitation {
  findingId: string;
  relevance: number;
  excerpt: string;
}

export interface InvestigationProgress {
  investigationId: string;
  status: "pending" | "analyzing" | "complete" | "failed";
  progress: number;
  currentStep: string;
}
