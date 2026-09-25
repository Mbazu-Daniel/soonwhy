import type { DetectionEvidence } from '../../../common/db/schema/findings';
import type { DetectionFinding } from './detection.types';

export type RcaConfidence = 'low' | 'medium' | 'high';

export interface RcaEvidenceItem {
  id: string;
  sourceFindingId: string;
  type: DetectionFinding['type'];
  severity: DetectionFinding['severity'];
  label: string;
  value: number | string;
  context?: DetectionEvidence['context'];
}

export interface RcaEvidence extends Record<string, unknown> {
  projectId: string;
  serviceName: string;
  severity: DetectionFinding['severity'];
  window: {
    start: Date;
    end: Date;
  };
  primaryFinding: RcaEvidenceItem;
  supportingFindings: RcaEvidenceItem[];
  traces: RcaEvidenceItem[];
  recommendations: RcaEvidenceItem[];
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
}

export interface RcaProvider {
  analyze(input: RcaEvidence): Promise<RcaProviderResult>;
}
