# 11: Ingestion API

**What to build:** A document defining the server-side ingestion endpoints and validation.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Ingestion endpoints:
  - POST /v1/logs
  - POST /v1/metrics
  - POST /v1/traces
  - POST /v1/requests
- [ ] Authentication (API key validation)
- [ ] Tenant resolution (org_id from API key)
- [ ] Payload validation (schema, required fields)
- [ ] Rate limiting (per API key, per org)
- [ ] NATS publishing (topic structure, message format)
- [ ] Idempotency (deduplication)
- [ ] Error responses (400, 401, 429, 500)

**Output:** `docs/architecture/ingestion-api.md`
