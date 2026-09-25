# SoonWhy UI Design System

## Product direction

SoonWhy is an intelligent OpenTelemetry observability product focused on turning telemetry into actionable bottleneck detection and root-cause evidence. The interface should feel like an engineering control room: dense enough for daily use, calm enough for long sessions, and explicit about evidence and uncertainty.

The visual language takes inspiration from modern observability products and the supplied reference, while remaining original to SoonWhy.

## Design principles

1. **Evidence first** — lead with what happened, where, when, and why the system believes it happened.
2. **Signal over decoration** — no generic gradients, glassmorphism, oversized marketing cards, or ornamental charts.
3. **Progressive density** — overview pages summarize; detail pages expose telemetry, traces, correlations, and evidence.
4. **Fast scanning** — strong hierarchy, compact metadata, monospace values, consistent status treatments.
5. **Safe actions** — destructive or high-impact operations require clear confirmation and never rely on color alone.
6. **Accessible by default** — visible focus, semantic controls, keyboard navigation, reduced-motion support, and WCAG AA contrast.

## Color tokens

| Token | Hex | Role |
|---|---|---|
| Primary | `#8BD125` | Primary actions and selected controls |
| Ink | `#182012` | Main text, navigation, high-contrast UI |
| Surface | `#F7FAF4` | App background and quiet surfaces |
| Accent | `#16931F` | Secondary positive state, links, active indicators |
| Highlight | `#C9E7EB` | Investigation context and information highlights |

Primary buttons use `#8BD125` with `#182012` text. Avoid white text on the primary green. For dark emphasis surfaces use `#182012` with `#F7FAF4` text. Critical states use a separate accessible red token and never rely on the requested green palette to communicate failure.

## Layout

- Desktop application shell: 240px persistent navigation rail + fluid content canvas.
- Top bar: 64px, project selector, time range, global search, notifications and user menu.
- Content max width: 1440px with responsive 16–24px outer padding and 16–20px card rhythm.
- Mobile: navigation becomes a drawer; cards collapse to one column; dense tables gain horizontal scrolling.
- Main content has a keyboard-accessible skip link and a focusable landmark.

## Information architecture

- **Overview** — service health, request/error/latency trends, active investigations, recent detections.
- **Services** — service inventory, ownership, runtime and repository context.
- **Detections** — intelligent bottleneck findings with confidence and evidence.
- **Errors** — grouped errors, affected services, first/last seen and frequency.
- **Logs** — full-text telemetry search, level filters, pagination and structured attributes.
- **Traces** — trace waterfall, span attributes, events and correlated logs.
- **Investigations** — an evidence timeline that connects detections, deployments, errors, traces and logs.
- **Settings** — project, ingestion, API keys, members, alerting and preferences.

## Core components

`AppShell`, `NavRail`, `TopBar`, `ProjectSwitcher`, `TimeRangePicker`, `HealthSummary`, `MetricCard`, `TrendChart`, `DetectionCard`, `SeverityBadge`, `EvidenceList`, `ServiceTable`, `TraceWaterfall`, `LogExplorer`, `DetailDrawer`, `EmptyState`, `CommandPalette`, `Toast`, and `ConfirmDialog`.

## Interaction rules

- Every status has an icon/label in addition to color.
- Hover states reveal context, not essential information.
- Tables support row focus, keyboard activation, column alignment and persistent filters.
- Detection cards expose confidence, evidence count, affected scope and next action without opening the detail page.
- URL state should own investigation filters and time ranges where practical so views can be shared.
- Motion is functional and respects `prefers-reduced-motion`.
- Do not invent telemetry to fill empty states. Empty states describe the action or data source required to populate the workflow.

## Implementation sequence

### Phase A — visual foundation — complete

- SoonWhy color/token system.
- Typography, borders, radii, shadows, focus rings and status tokens.
- Responsive application shell and navigation.
- Signal-first overview dashboard.
- Loading and no-project states.
- Keyboard skip navigation and reduced-motion support.

### Phase B — observability workflows — foundation complete

- Redesigned service inventory with ownership/runtime/repository context.
- Redesigned detection queue and evidence/RCA detail experience.
- Redesigned error groups with failure frequency and last-seen context.
- Redesigned log explorer with search, level filtering, structured attribute inspection and cursor pagination.
- Preserve existing API contracts and real telemetry data while improving workflow hierarchy.
- Remaining Phase B work: dedicated service detail, trace detail and correlated telemetry workflows.

### Phase C — investigation workflow

- Investigation timeline.
- Evidence graph and correlation panels.
- Deploy/change context.
- Shareable investigation URLs.

### Phase D — polish

- Command palette.
- Empty/loading/error states across every workflow.
- Responsive QA.
- Keyboard navigation and contrast audit.
- Performance pass and visual regression coverage.
