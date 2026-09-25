# SoonWhy UI Design System

## Product direction

SoonWhy is an intelligent OpenTelemetry observability product focused on turning telemetry into actionable bottleneck detection and root-cause evidence. The interface should feel like an engineering control room: dense enough for daily use, calm enough for long sessions, and explicit about evidence and uncertainty.

## Design principles

1. Evidence first.
2. Signal over decoration.
3. Progressive density.
4. Fast scanning with monospace telemetry values.
5. Safe actions with explicit confirmation.
6. Accessible by default with WCAG AA contrast, keyboard navigation and reduced motion.

## Color tokens

| Token | Hex | Role |
|---|---|---|
| Primary | `#8BD125` | Primary actions and selected controls |
| Ink | `#182012` | Main text and high-contrast UI |
| Surface | `#F7FAF4` | Application and quiet surfaces |
| Accent | `#16931F` | Positive state, links and active indicators |
| Highlight | `#C9E7EB` | Investigation and information context |

Critical states use an accessible red token and are paired with icons/labels. Do not rely on color alone.

## Phase A — complete

- Color/token foundation.
- Responsive application shell and navigation.
- Overview health and telemetry dashboard.
- Loading/no-project states.
- Skip navigation, focus states and reduced motion.

## Phase B — complete

- Service inventory and service detail.
- Detection queue, evidence and RCA.
- Error groups and log explorer.
- Trace explorer and span waterfall.
- Service-to-error/log and trace-to-span/event correlation.

## Phase C — complete

### Investigation workspace
- Dedicated investigation index with search and case status.
- Investigation detail route for an evidence-backed incident/case.

### Timeline
- Ordered detection, trace, error, log and deployment events.
- Explicit timestamps, service context, severity and source identifiers.
- Timeline remains descriptive and does not turn temporal correlation into causation.

### Evidence graph
- Evidence nodes expose their source labels and values.
- Correlation context is visually separated from deterministic evidence.
- Source IDs are preserved for future deep-linking.

### Change context
- Deployment/source-change records appear beside telemetry evidence.
- Missing change data is explicitly represented rather than fabricated.

### Shareable investigations
- Investigation URLs are stable route-based resources.
- Share action copies the current investigation URL to the clipboard.
- Shared investigations preserve project/case context through the URL.

## Phase D — in progress

### Completed in this phase
- Command palette with Cmd/Ctrl+K and mobile access.
- Accessible saved-view naming dialog instead of browser prompts.
- Retryable error states across Phase B/C data views.
- Route tree synchronized with all Phase B/C routes.
- Responsive fixes for dense logs and trace detail layouts.
- Removed non-functional time-range and notification controls until their backend/state contracts exist.
- Removed hardcoded telemetry-connected claims where the current API does not provide telemetry health.

### Navigation productivity
- Command palette available from the top bar and `⌘K` / `Ctrl+K`.
- Keyboard-first navigation across core observability surfaces.
- Mobile command-palette trigger.

### Saved views
- Lightweight saved-view storage scoped to the current browser profile.
- Saved routes can be reopened from the command palette.
- Saved views can be removed without affecting telemetry or backend state.

### Remaining production gate
- Run the full CI cycle on the latest Phase D commit and resolve any lint, type, test or build regressions.
- Browser-level QA at mobile, tablet and desktop breakpoints.
- Keyboard-only QA for navigation, dialogs, tables, filters and share actions.
- WCAG AA contrast verification against rendered states, including focus, critical and disabled states.
- Visual regression review against the agreed SoonWhy design system.
- Performance pass: route payloads, query churn, search/filter debounce and long-list rendering.
- Final PR review and merge readiness check.
