# 20: NestJS Conventions

**What to build:** A document defining NestJS module, controller, and service patterns.

**Blocked by:** 18 (needs TypeScript conventions)

**Status:** done

- [x] Module structure:
  - One module per feature (auth, projects, telemetry)
  - Shared modules for common functionality
- [x] Controller conventions:
  - One controller per resource
  - Use DTOs for request/response validation
  - Apply tenant resolution middleware
- [x] Service conventions:
  - Business logic in services, not controllers
  - Repository pattern for database access
  - Use Drizzle ORM for queries
- [x] Dependency injection:
  - Constructor injection
  - Use @Inject() for custom providers
- [x] Middleware and guards:
  - Auth guard for protected routes
  - Tenant guard for multi-tenancy
  - Rate limiting guard

**Output:** `docs/engineering/nestjs-conventions.md`
