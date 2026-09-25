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
6. **Accessible by default** — visible focus, semantic controls, keyboard navigation, and WCAG AA contrast.

## Color tokens

| Token | Hex | Role |
|---|---|---|
| Primary | `#8BD125` | Primary actions, selected controls, positive signal |
| Ink | `#182012` | Main text, navigation, high-contrast UI |
| Surface | `#F7FAF4` | App background and quiet surfaces |
| Accent | `#16931F` | Secondary positive state, links, active indicators |
| Highlight | `#C9E7EB` | Investigation context, information highlights, selected data regions |

Primary buttons use `#8BD125` with `#182012` text. Avoid white text on the primary green. For dark emphasis surfaces use `#182012` and the light surface token for text.

## Layout

- Desktop application shell: persistent 248px navigation rail + fluid content canvas.
- Top bar: 64px, project selector, time range, environment, global search, user menu.
- Content max width: 1440px with 24px outer padding and 20px internal card rhythm.
- Mobile: navigation becomes a drawer; cards collapse to one column; dense tables gain horizontal scrolling.

## Information architecture

- **Overview** — service health, request/error/latency trends, active investigations, recent detections.
- **Services** — service inventory, health, dependencies, throughput and latency.
- **Detections** — intelligent bottleneck findings with confidence and evidence.
- **Errors** — grouped errors, affected services, first/last seen, frequency and trace links.
- **Logs** — full-text telemetry search, filters, histogram, saved queries and detail drawer.
- **Traces** — trace waterfall, span attributes, events and correlated logs.
- **Investigations** — an evidence timeline that connects detections, deployments, errors, traces and logs.
- **Settings** — project, ingestion, API keys, members, alerting and preferences.

## Core components

`AppShell`, `NavRail`, `TopBar`, `ProjectSwitcher`, `TimeRangePicker`, `HealthSummary`, `MetricCard`, `TrendChart`, `DetectionCard`, `SeverityBadge`, `EvidenceList`, `ServiceTable`, `TraceWaterfall`, `LogExplorer`, `DetailDrawer`, `EmptyState`, `CommandPalette`, `Toast`, and `ConfirmDialog`.

## Interaction rules

- Every status has an icon/label in addition to color.
- Hover states reveal context, not essential information.
- Tables support row focus, keyboard activation, column alignment and persistent filters.
- Detection cards expose the confidence, evidence count, affected scope and next action without opening the detail page.
- URL state should own investigation filters and time ranges where practical so views can be shared.

## Implementation sequence

### Phase A — visual foundation

- Replace generic shadcn defaults with the SoonWhy token system.
- Establish typography, borders, radii, shadows, focus rings and status tokens.
- Redesign the application shell and navigation.
- Rework overview into a signal-first dashboard.

### Phase B — observability workflows

- Service inventory and service detail.
- Detection queue and detection detail.
- Log explorer with histogram and field filters.
- Trace detail and correlated logs.

### Phase C — investigation workflow

- Investigation timeline.
- Evidence graph and correlation panels.
- Deploy/change context.
- Shareable investigation URLs.

### Phase D — polish

- Command palette.
- Empty/loading/error states.
- Responsive QA.
- Keyboard navigation and contrast audit.
- Performance pass and visual regression coverage.
