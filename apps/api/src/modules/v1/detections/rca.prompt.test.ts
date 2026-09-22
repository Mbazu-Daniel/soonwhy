import { describe, expect, it } from 'vitest';
import {
  buildRcaPrompt,
  getRcaPromptDefinition,
  RCA_PROMPT_VERSION,
} from './rca.prompt';
import type { RcaEvidence } from './rca.types';

const evidence: RcaEvidence = {
  projectId: 'project_123',
  serviceName: 'checkout-api',
  severity: 'critical',
  window: {
    start: new Date('2026-09-22T00:00:00.000Z'),
    end: new Date('2026-09-22T00:15:00.000Z'),
  },
  primaryFinding: {
    id: 'finding_1:0',
    sourceFindingId: 'finding_1',
    type: 'latency',
    severity: 'critical',
    label: 'primary-latency',
    value: 1600,
  },
  supportingFindings: [],
  traces: [],
  recommendations: [],
};

describe('RCA prompt registry', () => {
  it('uses the current prompt version by default', () => {
    const prompt = buildRcaPrompt(evidence);

    expect(RCA_PROMPT_VERSION).toBe('v2');
    expect(prompt).toContain('Prompt version: v2');
    expect(prompt).toContain('Analyze only the supplied structured telemetry evidence.');
    expect(prompt).toContain('finding_1:0');
  });

  it('keeps older prompt definitions available for reproducibility', () => {
    const v1 = getRcaPromptDefinition('v1');
    const v2 = getRcaPromptDefinition('v2');

    expect(v1.version).toBe('v1');
    expect(v2.version).toBe('v2');
    expect(v1.systemPrompt).not.toBe(v2.systemPrompt);
  });

  it('builds a prompt from an explicitly selected version', () => {
    expect(buildRcaPrompt(evidence, 'v1')).toContain('Prompt version: v1');
  });

  it('rejects unsupported prompt versions', () => {
    expect(() => getRcaPromptDefinition('v99')).toThrow(
      'Unsupported RCA prompt version: v99',
    );
  });
});
