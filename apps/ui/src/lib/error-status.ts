import type { IssueStatus } from './error-groups';
import type { StatusFilter } from './error-status.types';

export const STATUS_LABELS: Record<IssueStatus, string> = {
  unresolved: 'Unresolved',
  regressed: 'Regressed',
  resolved: 'Resolved',
  ignored: 'Ignored',
};

export const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'ignored', label: 'Ignored' },
  { value: 'all', label: 'All' },
];

export function matchesFilter(status: IssueStatus, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return status === 'unresolved' || status === 'regressed';
  return status === filter;
}

export function countByFilter(statuses: IssueStatus[]): Record<StatusFilter, number> {
  return {
    open: statuses.filter((status) => matchesFilter(status, 'open')).length,
    resolved: statuses.filter((status) => status === 'resolved').length,
    ignored: statuses.filter((status) => status === 'ignored').length,
    all: statuses.length,
  };
}
