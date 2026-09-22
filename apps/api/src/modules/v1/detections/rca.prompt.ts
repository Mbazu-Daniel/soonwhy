import type { RcaEvidence } from './rca.types';

export const RCA_PROMPT_VERSION = 'v2';

const SYSTEM_PROMPT = [
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

export function buildRcaPrompt(evidence: RcaEvidence): string {
  const schema = {
    summary: 'string',
    rootCause: 'string',
    contributingFactors: ['string'],
    investigationSteps: ['string'],
    suggestedChanges: ['string'],
    evidenceRefs: ['string'],
    confidence: 'low | medium | high',
    limitations: ['string'],
  };

  return [
    SYSTEM_PROMPT,
    '',
    'Output schema:',
    JSON.stringify(schema),
    '',
    'Evidence:',
    JSON.stringify(evidence),
  ].join('\n');
}
