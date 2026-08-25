# Testing Strategy

## Principles

- Tests are first-class citizens, not afterthoughts.
- Prefer real implementations over mocks; mock only at system boundaries.
- Every PR must pass CI before merge.
- Test what matters: user-facing behavior over implementation details.

---

## Unit Testing

### Framework

Vitest with global imports (`vitest.config.ts`).

### Co-location

Tests live next to the code they cover:

```
packages/backend/src/auth/auth.service.ts
packages/backend/src/auth/auth.service.test.ts
```

### Naming

Pattern: `describe` for the module/class, `it` for the behavior.

```ts
describe("AuthService", () => {
  it("returns a JWT when credentials are valid", () => {});
  it("throws UnauthorizedException when user is not found", () => {});
});
```

### What to unit test

- Business logic functions
- Validators and transformers
- Pure utility functions
- Service methods with mocked dependencies

### What NOT to unit test

- Framework plumbing (NestJS decorators, React components' render output)
- Third-party library internals
- Trivial getters/setters

---

## Integration Testing

### Scope

Test API endpoints and database interactions against real PostgreSQL and ClickHouse instances.

### Isolation

Use Testcontainers to spin up ephemeral database containers per test suite. No shared state between suites.

### Tenant isolation

Every integration test that touches multi-tenant data must verify that tenant A cannot read tenant B's data.

### What to integration test

- API endpoint request/response cycle
- Database queries and migrations
- External service adapters (Stripe, AI providers) with recorded responses
- Auth middleware and guards

### Database strategy

- **PostgreSQL**: Run migrations against the test container before each suite.
- **ClickHouse**: Load schema from migration files; verify analytics queries.
- **Cleanup**: Drop and recreate databases between test suites, not between individual tests.

---

## E2E Testing

### Framework

Playwright for browser-based end-to-end tests.

### Scope

Critical user flows only. If it directly affects revenue or onboarding, it gets an E2E test.

### Covered flows

1. **Onboarding**: Sign up → workspace creation → first project.
2. **Dashboard**: Login → navigate dashboard → view metrics.
3. **AI Chat**: Send message → receive response → view history.

### Environment

- Tests run against a deployed preview or local dev server.
- Use fixtures for user accounts and seed data.
- Snapshot visual regressions only on key pages.

---

## Test File Organization

```
packages/
├── backend/
│   └── src/
│       ├── auth/
│       │   ├── auth.service.ts
│       │   ├── auth.service.test.ts        # unit
│       │   └── auth.integration.test.ts    # integration
│       └── ...
└── frontend/
    └── src/
        ├── components/
        │   ├── Button.tsx
        │   └── Button.test.tsx             # unit (render)
        └── ...
```

Root-level:

```
tests/
└── e2e/
    ├── onboarding.spec.ts
    ├── dashboard.spec.ts
    └── ai-chat.spec.ts
```

---

## Mocking Strategy

### When to mock

| Layer | Mock? | Notes |
|-------|-------|-------|
| Database | No | Use real DB via Testcontainers |
| External APIs (Stripe, OpenAI) | Yes | Use recorded HTTP responses or MSW |
| Time / Random | Yes | Use `vi.useFakeTimers()` |
| File system | Yes | Use `vi.mock()` or in-memory FS |
| Internal services | Only in unit tests | Prefer real in integration tests |

### Rules

- Never mock what you don't own.
- Mock at the boundary, not inside the code under test.
- Prefer dependency injection (NestJS) over `vi.mock()` for swapping implementations.
- Use MSW (Mock Service Worker) for HTTP mocking in browser tests.

---

## Test Data Factories

Use factory functions to create test data with sensible defaults.

```ts
// packages/backend/src/test/factories.ts
export function buildUser(overrides?: Partial<User>): User {
  return {
    id: crypto.randomUUID(),
    email: "test@example.com",
    workspaceId: "ws_test",
    createdAt: new Date(),
    ...overrides,
  };
}
```

### Seed scripts

- `pnpm seed:dev` — populate dev database with realistic data.
- `pnpm seed:test` — minimal data for integration test suites.

### Cleanup

- Integration tests: transactions rolled back after each test.
- E2E tests: dedicated test user with `test-` prefix, cleaned up after suite.

---

## Coverage Targets

| Scope | Target |
|-------|--------|
| Business logic (services, utils) | 80% |
| Overall (backend) | 60% |
| Frontend components | 60% |
| E2E critical flows | 100% of listed flows |

Enforce via `vitest --coverage` in CI. Fail the build if targets are not met.

---

## CI/CD Test Pipeline

```
PR opened / push to main
  ├── Lint (oxlint)
  ├── Format check (oxfmt)
  ├── Unit tests (vitest --run)
  ├── Integration tests (vitest --run --project integration)
  ├── E2E tests (playwright)
  └── Coverage report (upload to CI artifact)
```

### Pipeline details

1. **Lint + format**: Fast, runs first. Fail-fast.
2. **Unit tests**: Parallel across packages. ~2 min.
3. **Integration tests**: Start Testcontainers, run migrations, execute tests. ~5 min.
4. **E2E tests**: Start dev server, run Playwright. ~8 min.
5. **Coverage**: Generated from unit + integration. Uploaded as artifact.

### Branch rules

- `main`: All checks required.
- Feature branches: Unit + integration required. E2E optional but recommended.

---

## Commands

```bash
pnpm test                         # all unit tests
pnpm test -- --run                # single run (no watch)
pnpm test -- --coverage           # with coverage report
pnpm test:integration             # integration tests only (TBD)
pnpm test:e2e                     # Playwright E2E tests (TBD)
```
