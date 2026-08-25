# 23: Error Handling

**What to build:** A document defining error types, propagation, and user-facing format.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Error hierarchy:
  - AppError (base class)
  - ValidationError (400)
  - AuthError (401)
  - ForbiddenError (403)
  - NotFoundError (404)
  - ConflictError (409)
  - RateLimitError (429)
  - InternalError (500)
- [ ] Error propagation:
  - Throw at business logic layer
  - Catch in controller, format response
  - Log with context (requestId, userId, orgId)
- [ ] User-facing error format (from API conventions)
- [ ] Retryable vs non-retryable errors
- [ ] SDK fail-open behavior (catch and continue)
- [ ] Structured logging for errors

**Output:** `docs/engineering/error-handling.md`
