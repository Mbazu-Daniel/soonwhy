# 24: Observability Strategy

**What to build:** A document defining how Soonwhy monitors itself (dogfooding).

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Self-monitoring: Soonwhy uses Soonwhy
- [x] Internal metrics:
  - API latency (p50, p95, p99)
  - Ingestion rate (events/second)
  - Worker health (processing time, queue depth)
  - ClickHouse query performance
  - Redis memory and connections
  - NATS message throughput
- [x] Internal logs:
  - Structured JSON
  - Request context (requestId, orgId, userId)
  - Error tracking
- [x] Internal traces:
  - Distributed tracing across services
  - Span naming conventions
- [x] Alerting:
  - Internal incidents for system health
  - Anomaly detection on key metrics

**Output:** `docs/engineering/observability.md`
