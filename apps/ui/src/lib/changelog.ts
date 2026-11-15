export interface ChangelogEntry {
  date: string;
  title: string;
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-11-14',
    title: 'Setup guides, MCP docs and index health',
    highlights: [
      'New setup guides for the OpenTelemetry Collector, Python, Go, Docker, Kubernetes and nginx.',
      'Connect Claude Code, Cursor or Codex to your data from the API keys page.',
      'Platform admins can see size, splits and last event for every index.',
    ],
  },
  {
    date: '2026-11-01',
    title: 'Errors and traces from span data',
    highlights: [
      'Spans keep their attributes, resource, events, links and exceptions.',
      'Errors come from failed spans, 4xx and 5xx responses and exception events, grouped by fingerprint.',
      'Open an error in traces and see exactly the traces that were counted.',
      'Trace explorer with filters, charts, and a jump from a span to its logs.',
    ],
  },
  {
    date: '2026-10-20',
    title: 'Log search upgrade',
    highlights: [
      'Full query syntax with clear errors, a field panel, and include and exclude chips.',
      'Context view, NDJSON and CSV export, saved views and share links.',
      'Service pages show operations, dependencies and failing operations.',
    ],
  },
];

export function sortedChangelog(entries: ChangelogEntry[] = CHANGELOG): ChangelogEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}
