# 21: Testing Strategy

**What to build:** A document defining unit, integration, and E2E testing approach.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Unit testing:
  - Framework: Vitest
  - Co-located tests (`*.test.ts` files)
  - Coverage target: 80% business logic, 60% overall
  - Mock external services (Stripe, AI providers)
  - Use real databases for integration tests
- [ ] Integration testing:
  - Test API endpoints against real PostgreSQL + ClickHouse
  - Use test containers for isolation
  - Test tenant isolation
- [ ] E2E testing:
  - Framework: Playwright
  - Critical user flows only
  - Test onboarding, dashboard, AI chat
- [ ] Test data management:
  - Seed scripts for development
  - Test fixtures for integration tests
  - Cleanup after tests

**Output:** `docs/engineering/testing-strategy.md`
