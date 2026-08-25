# Definition of Done

A task is complete when **every** item below is satisfied.

---

## Code Complete

- [ ] Feature works as specified in the issue/ticket
- [ ] All acceptance criteria met
- [ ] Error handling implemented (see `docs/engineering/error-handling.md`)
- [ ] Logging added where meaningful
- [ ] No unrelated changes bundled in the same PR

---

## Testing

- [ ] Unit tests written for new business logic
- [ ] Integration tests written for API endpoints, database queries, or external service adapters
- [ ] Existing tests still pass (no regressions)
- [ ] Test coverage meets minimum thresholds (see `docs/engineering/testing-strategy.md`)

---

## Code Quality

- [ ] Code reviewed by at least one other contributor
- [ ] No lint errors (`pnpm lint`)
- [ ] No type errors (`pnpm build`)
- [ ] Formatting applied (`pnpm format`)
- [ ] Follows TypeScript conventions in `docs/engineering/typescript-conventions.md`

---

## CI

- [ ] All CI checks pass (lint, format, unit tests, integration tests, build)
- [ ] No flaky test failures

---

## Security

- [ ] No secrets or credentials committed
- [ ] Input validated and sanitized
- [ ] Authorization checks in place (tenant isolation respected)
- [ ] No new dependency vulnerabilities introduced (`pnpm audit`)

---

## Performance

- [ ] No N+1 queries or unbounded loops
- [ ] Database queries use appropriate indexes
- [ ] Large responses paginated
- [ ] Expensive operations documented or deferred with a `todo:` comment

---

## Accessibility (UI tasks)

- [ ] Semantic HTML used where applicable
- [ ] Keyboard navigable
- [ ] Screen reader labels present on interactive elements
- [ ] Color contrast meets WCAG AA

---

## Documentation

- [ ] README or relevant doc updated (API docs, usage examples, config changes)
- [ ] Breaking changes documented
- [ ] Issue/ticket marked complete in the tracker

---

## Final Check

- [ ] No unrelated changes
- [ ] Commit messages follow conventional format
- [ ] PR description explains what changed and why
