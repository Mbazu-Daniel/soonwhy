# 23: Error Handling

**What to build:** A document defining error types, propagation, and user-facing format.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Error hierarchy:
  - AppError (base class)
  - ValidationError (400)
  - AuthError (401)
  - ForbiddenError (403)
  - NotFoundError (404)
  - ConflictError (409)
  - RateLimitError (429)
  - InternalError (500)
- [x] Error propagation:
  - Throw at business logic layer
  - Catch in controller, format response
  - Log with context (requestId, userId, orgId)
- [x] User-facing error format (from API conventions)
- [x] Retryable vs non-retryable errors
- [x] SDK fail-open behavior (catch and continue)
- [x] Structured logging for errors

**Output:** `docs/engineering/error-handling.md`
