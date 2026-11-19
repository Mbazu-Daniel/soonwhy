export interface AnalysisSummary {
  id: string;
  summary: string;
  rootCause: string;
  suggestedChanges: string[];
  confidence: string;
}

export interface AnalyzedFinding {
  id: string;
  title: string;
  serviceName: string;
}
