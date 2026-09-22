import { describe, expect, it } from 'vitest';
import type { RcaEvidence } from './rca.types';
import { validateRcaAnalysis } from './rca.validation';

const evidence: RcaEvidence = {
  projectId: 'project_123',
  serviceName: 'checkout-api',
  severity: 'critical',
  window: {
    start: new Date('2026-09-22T00:00:00.000Z'),
    end: new Date('2026-09-22T00:15:00.000Z'),
  },
  primaryFinding: {
    id: 'finding_latency:0',
    sourceFindingId: 'finding_latency',
    type: 'latency',
    severity: 'critical',
    label: 'primary-latency',
    value: 1600,
  },
  supportingFindings: [],
  traces: [],
  recommendations: [],
};

describe('validateRcaAnalysis', () => {
  it('accepts a valid grounded analysis', () => {
    expect(
      validateRcaAnalysis(
        {
          summary: 'Checkout latency increased.',
          rootCause: 'The available evidence points to the database dependency.',
          contributingFactors: ['Database latency increased.'],
          investigationSteps: ['Inspect the database query plan.'],
          suggestedChanges: ['Review the query and indexes.'],
          evidenceRefs: ['finding_latency:0'],
          confidence: 'medium',
          limitations: ['The evidence does not establish the exact query plan.'],
        },
        evidence,
      ),
    ).toMatchObject({ confidence: 'medium' });
  });

  it('rejects malformed analysis', () => {
    expect(() =>
      validateRcaAnalysis(
        {
          summary: 'missing required fields',
          confidence: 'certain',
        },
        evidence,
      ),
    ).toThrow();
  });

  it('rejects evidence references that were not supplied', () => {
    expect(() =>
      validateRcaAnalysis(
        {
          summary: 'Checkout latency increased.',
          rootCause: 'Unknown.',
          contributingFactors: [],
          investigationSteps: [],
          suggestedChanges: [],
          evidenceRefs: ['invented:0'],
          confidence: 'low',
          limitations: ['Insufficient evidence.'],
        },
        evidence,
      ),
    ).toThrow('unknown evidence ID');
  });
});
