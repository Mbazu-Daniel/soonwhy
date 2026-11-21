import { FINDING_STATUS_TABS } from './findings.constants';
import type { DetectionFinding, FindingEvidence, FindingStatus } from './findings.types';

export function ruleLabel(type: string): string {
  return type.replace(/_/g, '-').toUpperCase();
}

export function splitEvidence(finding: DetectionFinding): { facts: FindingEvidence[]; recommendations: FindingEvidence[] } {
  return {
    facts: finding.evidence.filter((item) => item.kind !== 'recommendation'),
    recommendations: finding.evidence.filter((item) => item.kind === 'recommendation'),
  };
}

export function evidenceObject(finding: DetectionFinding): Record<string, unknown> {
  const { facts } = splitEvidence(finding);
  return {
    service: finding.serviceName,
    observed: `${finding.observedValue}${finding.unit}`,
    threshold: `${finding.threshold}${finding.unit}`,
    ...Object.fromEntries(facts.map((item) => [item.label, item.value])),
  };
}

export function matchesFilters(
  finding: DetectionFinding,
  filters: { query: string; severity: string; type: string; category?: string },
): boolean {
  const query = filters.query.trim().toLowerCase();
  if (filters.severity && finding.severity !== filters.severity) return false;
  if (filters.type && finding.type !== filters.type) return false;
  if (filters.category && finding.category !== filters.category) return false;
  if (!query) return true;
  return `${finding.title} ${finding.serviceName} ${finding.type}`.toLowerCase().includes(query);
}

export function statusActions(status: FindingStatus): Array<{ to: FindingStatus; label: string }> {
  if (status === 'open') return [{ to: 'resolved', label: 'Mark resolved' }, { to: 'ignored', label: 'Ignore' }];
  return [{ to: 'open', label: 'Reopen' }];
}

export function statusLabel(status: FindingStatus): string {
  return FINDING_STATUS_TABS.find((tab) => tab.value === status)?.label ?? status;
}
