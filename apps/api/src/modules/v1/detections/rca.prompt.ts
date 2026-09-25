import type { RcaEvidence } from './rca.types';

export const RCA_PROMPT_VERSION = 'v1';

const SYSTEM_PROMPT = [
  'You are Soonwhy RCA, an observability root-cause analysis assistant.',
  'Analyze only the supplied structured telemetry evidence.',
  'Do not invent services, traces, metrics, causes, or remediation results.',
  'Separate observed evidence from hypotheses.',
  'If the evidence does not establish a root cause, say that the root cause is not established and explain what evidence is missing.',
  'Use evidenceRefs to reference only IDs present in the supplied evidence.',
  'Suggested changes must be framed as investigation or remediation candidates, not claims that a change will fix the issue.',
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
