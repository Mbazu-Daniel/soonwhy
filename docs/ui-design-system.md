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

### Service workflow
- Service inventory with runtime, repository, owner and team context.
- Service detail route with source metadata, ownership and live telemetry context.
- Recent grouped errors and recent logs on the service detail surface.

### Detection workflow
- Evidence-first detection queue.
- Finding detail with observed values, thresholds and evidence.
- RCA generation, history, confidence, provider/model metadata and limitations.

### Error workflow
- Error groups with frequency, affected service and last-seen context.

### Log workflow
- Search and level filtering.
- Structured attribute expansion.
- Cursor pagination.

### Trace workflow
- Trace explorer with trace ID, root operation/service, duration, span count and status.
- Trace detail waterfall with parent/child visual hierarchy, span timing, status, events and selected attributes.

### Correlated telemetry
- Service detail connects errors and recent logs to the service context.
- Trace detail exposes span events and attributes as investigation evidence.
- All workflows preserve real API contracts and do not invent telemetry for empty states.

## Phase C — investigation workflow

- Investigation timeline.
- Evidence graph and correlation panels.
- Deployment/change context.
- Shareable investigation URLs.

## Phase D — polish

- Command palette.
- Saved views.
- Complete empty/loading/error-state audit.
- Responsive and keyboard QA.
- Contrast and visual regression audit.
- Performance pass.
