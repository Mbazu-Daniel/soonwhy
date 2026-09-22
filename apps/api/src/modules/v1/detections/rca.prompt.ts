import type { RcaEvidence } from './rca.types';

export const RCA_PROMPT_VERSION = 'v2';

export interface RcaPromptDefinition {
  version: string;
  systemPrompt: string;
  schema: {
    summary: 'string';
    rootCause: 'string';
    contributingFactors: string[];
    investigationSteps: string[];
    suggestedChanges: string[];
    evidenceRefs: string[];
    confidence: 'low | medium | high';
    limitations: string[];
  };
}

const BASE_SYSTEM_PROMPT = [
  'You are Soonwhy RCA, an observability root-cause analysis assistant.',
  'Analyze only the supplied structured telemetry evidence.',
  'Do not invent services, traces, metrics, causes, or remediation results.',
  'Every factual claim about a service, trace, metric, dependency, or finding must be supported by supplied evidence and referenced with evidenceRefs.',
  'Separate observed evidence from hypotheses.',
  'If there is no supporting evidence, say that the root cause is not established, use low or medium confidence, and identify the missing evidence.',
  'If evidence conflicts, explicitly describe the conflict in limitations and do not claim a high-confidence root cause.',
  'Suggested changes must be framed as investigation or remediation candidates, not claims that a change will fix the issue.',
  'When a remediation is not directly supported by the evidence, label it as a candidate and state what should be validated first.',
  'Use evidenceRefs to reference only IDs present in the supplied evidence.',
  'Return valid JSON matching the requested schema and no markdown.',
].join(' ');

const RCA_PROMPT_DEFINITIONS: Record<string, RcaPromptDefinition> = {
  v1: {
    version: 'v1',
    systemPrompt: [
      'You are Soonwhy RCA, an observability root-cause analysis assistant.',
      'Analyze only the supplied structured telemetry evidence.',
      'Do not invent services, traces, metrics, causes, or remediation results.',
      'Use evidenceRefs to reference only IDs present in the supplied evidence.',
      'Return valid JSON matching the requested schema and no markdown.',
    ].join(' '),
    schema: {
      summary: 'string',
      rootCause: 'string',
      contributingFactors: ['string'],
      investigationSteps: ['string'],
      suggestedChanges: ['string'],
      evidenceRefs: ['string'],
      confidence: 'low | medium | high',
      limitations: ['string'],
    },
  },
  v2: {
    version: 'v2',
    systemPrompt: BASE_SYSTEM_PROMPT,
    schema: {
      summary: 'string',
      rootCause: 'string',
      contributingFactors: ['string'],
      investigationSteps: ['string'],
      suggestedChanges: ['string'],
      evidenceRefs: ['string'],
      confidence: 'low | medium | high',
      limitations: ['string'],
    },
  },
};

export function getRcaPromptDefinition(version = RCA_PROMPT_VERSION): RcaPromptDefinition {
  const definition = RCA_PROMPT_DEFINITIONS[version];
  if (!definition) throw new Error(`Unsupported RCA prompt version: ${version}`);
  return definition;
}

export function buildRcaPrompt(
  evidence: RcaEvidence,
  version = RCA_PROMPT_VERSION,
): string {
  const definition = getRcaPromptDefinition(version);

  return [
    definition.systemPrompt,
    '',
    `Prompt version: ${definition.version}`,
    '',
    'Output schema:',
    JSON.stringify(definition.schema),
    '',
    'Evidence:',
    JSON.stringify(evidence),
  ].join('\n');
}
