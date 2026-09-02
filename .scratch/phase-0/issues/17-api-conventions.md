# 17: API Conventions

**What to build:** A document defining REST API patterns, versioning, and error format.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] API versioning strategy (URL-based: /v1/)
- [ ] Request/response format (JSON)
- [ ] Error format:
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
- [ ] Pagination (cursor-based)
- [ ] Filtering and sorting conventions
- [ ] Rate limit headers (X-RateLimit-*)
- [ ] Authentication headers (Authorization: Bearer <token>)
- [ ] Idempotency keys for mutations

**Output:** `docs/architecture/api-conventions.md`
