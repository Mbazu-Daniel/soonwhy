# 20: NestJS Conventions

**What to build:** A document defining NestJS module, controller, and service patterns.

**Blocked by:** 18 (needs TypeScript conventions)

**Status:** ready-for-agent

- [ ] Module structure:
  - One module per feature (auth, projects, telemetry)
  - Shared modules for common functionality
- [ ] Controller conventions:
  - One controller per resource
  - Use DTOs for request/response validation
  - Apply tenant resolution middleware
- [ ] Service conventions:
  - Business logic in services, not controllers
  - Repository pattern for database access
  - Use Drizzle ORM for queries
- [ ] Dependency injection:
  - Constructor injection
  - Use @Inject() for custom providers
- [ ] Middleware and guards:
  - Auth guard for protected routes
  - Tenant guard for multi-tenancy
  - Rate limiting guard

**Output:** `docs/engineering/nestjs-conventions.md`
