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

## Phase D — code complete

### Navigation productivity
- Command palette available from the top bar and `⌘K` / `Ctrl+K`.
- Keyboard-first navigation across core observability surfaces.
- Mobile command-palette trigger.

### Saved views
- Accessible saved-view naming dialog instead of browser prompts.
- Lightweight saved-view storage scoped to the current browser profile.
- Saved routes can be reopened from the command palette.
- Saved views can be removed without affecting telemetry or backend state.

### Reliability
- Retryable error states across Phase B/C data views.
- Loading and empty states remain explicit and do not fabricate telemetry.
- Route tree synchronized with all Phase B/C routes.
- Non-functional time-range and notification controls removed until their backend/state contracts exist.
- Hardcoded telemetry-connected claims removed where the current API does not provide telemetry health.

### Responsive and accessibility foundations
- Dense logs and trace detail layouts adapt to narrow screens.
- Focus-visible treatment and semantic labels are present across the new productivity UI.
- Reduced-motion behavior is defined globally.
- Critical states use icon/label treatment in addition to color.

### Validation
- Latest Phase D CI run #348 completed successfully.
- Type/build/test regressions from the Phase D implementation are cleared.
- No ClickHouse or fabricated telemetry was introduced by the UI work.

### Manual merge gate
The remaining checks are browser-level validation rather than missing product implementation:
- Mobile, tablet and desktop visual QA.
- Keyboard-only pass across navigation, dialogs, filters and share actions.
- Rendered WCAG AA contrast verification.
- Visual regression review.
- Browser performance profiling on long telemetry lists.
- Final PR review before merge.

## Phase E — onboarding foundation complete

The first Phase E onboarding slice is implemented on `feat/world-class-observability-ui`.

- Public landing page with product positioning and primary entry points.
- Auth UX for sign-up and sign-in with accessible errors, password visibility controls and clear next steps.
- Organization selection and creation now enter the onboarding flow instead of dropping directly into an empty dashboard.
- Project creation/selection is backed by the existing project API.
- Project API key creation uses the existing tenant-scoped API key endpoint and displays the raw key only at creation time.
- OpenTelemetry setup includes a real SDK snippet and a first-telemetry verification loop against the dashboard API.
- First-time dashboard users receive a lightweight persisted product tour.
- No fabricated telemetry is introduced. Verification reports only data returned by the API.

The Phase E onboarding journey is:

`Landing → Sign up/sign in → Organization → Project → API key + OTel setup → First telemetry verification → Dashboard tour`

The current tour is intentionally dependency-free. A Driver.js-based anchored tour can replace the presentation layer later without changing onboarding state or backend contracts.

### Phase E — next

- Browser QA across mobile/tablet/desktop.
- Auth/session edge-case coverage.
- Persisted onboarding completion state on the server when the backend contract exists.
- OTel setup examples for Node, Python and Go.
- Contextual setup guidance for users who skip telemetry verification.
- Driver.js anchored tours when the final dashboard target selectors are stable.

Phase E covers the complete acquisition and activation journey outside the authenticated observability workspace:

- Public landing page.
- Authentication UX.
- Organization creation onboarding.
- Project creation onboarding.
- OpenTelemetry connection/setup flow.
- First-telemetry verification.
- Driver.js product tours and contextual onboarding.
