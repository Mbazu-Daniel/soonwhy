# 10: SDK Client Design

**What to build:** A document defining the Node SDK's client-side design and behavior.

**Blocked by:** None (can start immediately)

 **Status: done**

- [x] Initialization flow (Soonwhy.init)
- [x] Configuration options (apiKey, endpoint, batchSize, flushInterval)
- [x] Event batching (buffer size, flush interval, flush on shutdown)
- [x] Retry mechanism (exponential backoff, max retries)
- [x] Fail-open behavior (application continues if Soonwhy is down)
- [x] Instrumentation hooks:
  - HTTP requests (auto-capture latency, status code)
  - Database queries (slow query detection)
  - Redis operations (latency, errors)
  - Queue jobs (processing time, failures)
  - Cron jobs (execution time, misses)
- [x] PII filtering and secret redaction
- [x] Payload limits

**Output:** `docs/architecture/sdk-client.md`
