# 10: SDK Client Design

**What to build:** A document defining the Node SDK's client-side design and behavior.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Initialization flow (Soonwhy.init)
- [ ] Configuration options (apiKey, endpoint, batchSize, flushInterval)
- [ ] Event batching (buffer size, flush interval, flush on shutdown)
- [ ] Retry mechanism (exponential backoff, max retries)
- [ ] Fail-open behavior (application continues if Soonwhy is down)
- [ ] Instrumentation hooks:
  - HTTP requests (auto-capture latency, status code)
  - Database queries (slow query detection)
  - Redis operations (latency, errors)
  - Queue jobs (processing time, failures)
  - Cron jobs (execution time, misses)
- [ ] PII filtering and secret redaction
- [ ] Payload limits

**Output:** `docs/architecture/sdk-client.md`
