import { describe, expect, it } from 'vitest';
import { buildRcaPrompt } from './rca.prompt';
import type { RcaEvidence } from './rca.types';

describe('buildRcaPrompt', () => {
  it('requires evidence-grounded JSON RCA output', () => {
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

    const prompt = buildRcaPrompt(evidence);

    expect(prompt).toContain('Analyze only the supplied structured telemetry evidence.');
    expect(prompt).toContain('Return valid JSON');
    expect(prompt).toContain('"rootCause":"string"');
    expect(prompt).toContain('finding_1:0');
    expect(prompt).toContain('checkout-api');
  });
});
