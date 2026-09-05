# 11: Ingestion API

**What to build:** A document defining the server-side ingestion endpoints and validation.

**Blocked by:** None (can start immediately)

 **Status: done**

- [x] Ingestion endpoints:
  - POST /v1/logs
  - POST /v1/metrics
  - POST /v1/traces
  - POST /v1/requests
- [x] Authentication (API key validation)
- [x] Tenant resolution (org_id from API key)
- [x] Payload validation (schema, required fields)
- [x] Rate limiting (per API key, per org)
- [x] NATS publishing (topic structure, message format)
- [x] Idempotency (deduplication)
- [x] Error responses (400, 401, 429, 500)

**Output:** `docs/architecture/ingestion-api.md`
