import { describe, expect, it } from 'vitest';
import type { RcaAnalysis, RcaEvidence } from './rca.types';
import { validateRcaQuality } from './rca.quality';

function evidence(overrides: Partial<RcaEvidence> = {}): RcaEvidence {
  return {
    projectId: 'project_123',
    serviceName: 'checkout-api',
    severity: 'critical',
    window: {
      start: new Date('2026-09-22T10:00:00Z'),
      end: new Date('2026-09-22T10:15:00Z'),
    },
    primaryFinding: {
      id: 'latency:0',
      sourceFindingId: 'latency',
      type: 'latency',
      severity: 'critical',
      label: 'primary-latency',
      value: 1600,
    },
    supportingFindings: [{
      id: 'dependency:0',
      sourceFindingId: 'dependency',
      type: 'dependency_latency',
      severity: 'critical',
      label: 'dependency-latency',
      value: 900,
    }],
    traces: [{
      id: 'trace:0',
      sourceFindingId: 'trace',
      type: 'trace_span',
      severity: 'critical',
      label: 'correlated-trace',
      value: 'trace_1',
    }],
    recommendations: [],
    ...overrides,
  };
}

function analysis(overrides: Partial<RcaAnalysis> = {}): RcaAnalysis {
  return {
    summary: 'Checkout latency increased.',
    rootCause: 'The evidence points to the database dependency.',
    contributingFactors: [],
    investigationSteps: ['Inspect the query plan.'],
    suggestedChanges: ['Candidate: review the query plan and indexes.'],
    evidenceRefs: ['latency:0', 'dependency:0', 'trace:0'],
    confidence: 'medium',
    limitations: [],
    ...overrides,
  };
}

describe('validateRcaQuality', () => {
  it('accepts a known bottleneck explanation grounded in supplied findings', () => {
    expect(() => validateRcaQuality(analysis(), evidence())).not.toThrow();
  });

  it('requires uncertainty when evidence is insufficient', () => {
    expect(() => validateRcaQuality(
      analysis({
        rootCause: 'The database is definitely the root cause.',
        confidence: 'medium',
        evidenceRefs: ['latency:0'],
      }),
      evidence({ supportingFindings: [], traces: [] }),
    )).toThrow('root cause is not established');
  });

  it('allows insufficient evidence when the analysis states the limitation', () => {
    expect(() => validateRcaQuality(
      analysis({
        rootCause: 'The root cause is not established from the available evidence.',
        confidence: 'low',
        suggestedChanges: ['Candidate: collect database dependency traces.'],
        evidenceRefs: ['latency:0'],
        limitations: ['No supporting dependency or trace evidence is available.'],
      }),
      evidence({ supportingFindings: [], traces: [] }),
    )).not.toThrow();
  });

  it('requires uncertainty when evidence conflicts', () => {
    expect(() => validateRcaQuality(
      analysis({ confidence: 'high' }),
      evidence({
        supportingFindings: [{
          id: 'error:0',
          sourceFindingId: 'error',
          type: 'error_rate',
          severity: 'critical',
          label: 'error-rate',
          value: 12,
          context: { conflict: true },
        }],
      }),
    )).toThrow('confidence cannot be high when evidence is conflicting');
  });

  it('requires a limitation for conflicting evidence', () => {
    expect(() => validateRcaQuality(
      analysis({ confidence: 'medium', limitations: ['Conflicting signals require further investigation.'] }),
      evidence({
        supportingFindings: [{
          id: 'error:0',
          sourceFindingId: 'error',
          type: 'error_rate',
          severity: 'critical',
          label: 'error-rate',
          value: 12,
          context: { conflict: true },
        }],
      }),
    )).not.toThrow();

    expect(() => validateRcaQuality(
      analysis({ confidence: 'medium', limitations: [] }),
      evidence({
        supportingFindings: [{
          id: 'error:0',
          sourceFindingId: 'error',
          type: 'error_rate',
          severity: 'critical',
          label: 'error-rate',
          value: 12,
          context: { conflict: true },
        }],
      }),
    )).toThrow('limitations');
  });

  it('rejects unsupported remediation language when evidence is insufficient', () => {
    expect(() => validateRcaQuality(
      analysis({
        rootCause: 'The root cause is not established from the available evidence.',
        confidence: 'low',
        suggestedChanges: ['Increase the database server size immediately.'],
        evidenceRefs: ['latency:0'],
      }),
      evidence({ supportingFindings: [], traces: [] }),
    )).toThrow('remediation must be framed');
  });
});
