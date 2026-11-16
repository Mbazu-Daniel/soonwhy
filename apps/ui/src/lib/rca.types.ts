export type RcaSeverity = 'warning' | 'critical';
export type RcaConfidence = 'low' | 'medium' | 'high';

export interface RcaAnalysis {
  id: string;
  serviceName: string;
  severity: RcaSeverity;
  summary: string;
  rootCause: string;
  contributingFactors: string[];
  investigationSteps: string[];
  suggestedChanges: string[];
  evidenceRefs: string[];
  confidence: RcaConfidence;
  limitations: string[];
  provider: string;
  model: string;
  promptVersion: string;
  credentialSource: 'byok' | 'platform' | null;
  quotaWarning?: boolean;
  createdAt: string;
}
