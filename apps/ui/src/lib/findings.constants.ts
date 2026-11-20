import type { FindingCategory, FindingStatus } from './findings.types';

export const FINDING_STATUS_TABS: Array<{ value: FindingStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'ignored', label: 'Ignored' },
];

export const FINDING_CATEGORY_LABELS: Record<FindingCategory, string> = {
  error: 'Errors',
  performance: 'Performance',
  security: 'Security',
  vulnerability: 'Vulnerabilities',
};

export const FINDING_CATEGORIES = Object.keys(FINDING_CATEGORY_LABELS) as FindingCategory[];

export const FINDINGS_PAGE_SIZE = 200;
export const REPORT_DAY_OPTIONS = [7, 30, 90];
