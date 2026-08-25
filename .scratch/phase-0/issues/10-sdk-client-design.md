# 10: SDK Client Design

**What to build:** A document defining the Node SDK's client-side design and behavior.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Initialization flow (Soonwhy.init)
- [x] Configuration options (apiKey, endpoint, batchSize, flushInterval)
- [x] Event batching (buffer size, flush interval, flush on shutdown)
- [x] Retry mechanism (exponential backoff, max retries)
- [x] Fail-open behavior (application continues if Soonwhy is down)
- [x] Instrumentation hooks:
  - [x] HTTP requests (auto-capture latency, status code)
  - [x] Database queries (slow query detection)
  - [x] Redis operations (latency, errors)
  - [x] Queue jobs (processing time, failures)
  - [x] Cron jobs (execution time, misses)
- [x] PII filtering and secret redaction
- [x] Payload limits

**Output:** `docs/architecture/sdk.md`
