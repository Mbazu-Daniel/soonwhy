# 17: API Conventions

**What to build:** A document defining REST API patterns, versioning, and error format.

**Blocked by:** None (can start immediately)

 **Status: done**

- [x] API versioning strategy (URL-based: /v1/)
- [x] Request/response format (JSON)
- [x] Error format:
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid payload",
      "details": [{"field": "timestamp", "issue": "required"}],
      "requestId": "req_abc123"
    }
  }
  ```
- [x] Pagination (cursor-based)
- [x] Filtering and sorting conventions
- [x] Rate limit headers (X-RateLimit-*)
- [x] Authentication headers (Authorization: Bearer <token>)
- [x] Idempotency keys for mutations

**Output:** `docs/architecture/api-conventions.md`
