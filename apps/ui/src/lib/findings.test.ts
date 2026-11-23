import { describe, expect, it } from 'vitest';
import { evidenceObject, formatValue, matchesFilters, ruleLabel, splitEvidence, statusActions, statusLabel } from './findings';
import type { DetectionFinding } from './findings.types';

const finding: DetectionFinding = {
  id: 'f1',
  projectId: 'p1',
  serviceName: 'checkout',
  type: 'error_group',
  severity: 'critical',
  title: 'TypeError in handler',
  description: 'd',
  observedValue: 12,
  threshold: 1,
  unit: ' errors',
  windowStart: '2026-11-01T00:00:00Z',
  windowEnd: '2026-11-01T01:00:00Z',
  category: 'error',
  status: 'open',
  occurrences: 3,
  lastSeenAt: '2026-11-01T01:00:00Z',
  resolvedAt: null,
  recommendation: 'fix it',
  evidence: [
    { kind: 'metric', label: 'count', value: 12 },
    { kind: 'recommendation', label: 'fix', value: 'guard the null' },
  ],
};

describe('findings helpers', () => {
  it('formats the rule label', () => {
    expect(ruleLabel('database_n_plus_one')).toBe('DATABASE-N-PLUS-ONE');
  });

  it('keeps recommendations out of the evidence facts', () => {
    const { facts, recommendations } = splitEvidence(finding);
    expect(facts).toHaveLength(1);
    expect(recommendations[0]?.value).toBe('guard the null');
  });

  it('builds a flat evidence object without recommendations', () => {
    expect(evidenceObject(finding)).toEqual({ service: 'checkout', observed: '12 errors', threshold: '1 error', count: 12 });
  });

  it('filters by severity, rule and text', () => {
    const base = { query: '', severity: '', type: '' };
    expect(matchesFilters(finding, base)).toBe(true);
    expect(matchesFilters(finding, { ...base, severity: 'warning' })).toBe(false);
    expect(matchesFilters(finding, { ...base, type: 'latency' })).toBe(false);
    expect(matchesFilters(finding, { ...base, query: 'CHECKOUT' })).toBe(true);
    expect(matchesFilters(finding, { ...base, query: 'nope' })).toBe(false);
  });

  it('filters by category', () => {
    const base = { query: '', severity: '', type: '' };
    expect(matchesFilters(finding, { ...base, category: 'error' })).toBe(true);
    expect(matchesFilters(finding, { ...base, category: 'security' })).toBe(false);
  });

  it('offers resolve and ignore on an open finding and reopen otherwise', () => {
    expect(statusActions('open').map((action) => action.to)).toEqual(['resolved', 'ignored']);
    expect(statusActions('resolved').map((action) => action.to)).toEqual(['open']);
    expect(statusActions('ignored').map((action) => action.to)).toEqual(['open']);
    expect(statusLabel('resolved')).toBe('Resolved');
  });
});

describe('formatValue', () => {
  it('puts a space before a word unit', () => {
    expect(formatValue(12, 'requests')).toBe('12 requests');
    expect(formatValue(12, ' errors')).toBe('12 errors');
  });

  it('uses the singular for exactly one', () => {
    expect(formatValue(1, 'occurrences')).toBe('1 occurrence');
    expect(formatValue(1, ' errors')).toBe('1 error');
    expect(formatValue(2, 'occurrences')).toBe('2 occurrences');
  });

  it('keeps symbols and short units attached', () => {
    expect(formatValue(250, 'ms')).toBe('250ms');
    expect(formatValue(5, '%')).toBe('5%');
    expect(formatValue(3, 's')).toBe('3s');
  });

  it('shows just the number when there is no unit', () => {
    expect(formatValue(7, '')).toBe('7');
  });
});

