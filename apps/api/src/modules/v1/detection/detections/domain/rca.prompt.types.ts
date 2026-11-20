export interface RcaPromptDefinition {
  version: string;
  systemPrompt: string;
  schema: {
    summary: "string";
    rootCause: "string";
    contributingFactors: string[];
    investigationSteps: string[];
    suggestedChanges: string[];
    evidenceRefs: string[];
    confidence: "low | medium | high";
    limitations: string[];
  };
}
