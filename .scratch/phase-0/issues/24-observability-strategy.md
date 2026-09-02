# 24: Observability Strategy

**What to build:** A document defining how Soonwhy monitors itself (dogfooding).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Self-monitoring: Soonwhy uses Soonwhy
- [ ] Internal metrics:
  - API latency (p50, p95, p99)
  - Ingestion rate (events/second)
  - Worker health (processing time, queue depth)
  - ClickHouse query performance
  - Redis memory and connections
  - NATS message throughput
- [ ] Internal logs:
  - Structured JSON
  - Request context (requestId, orgId, userId)
  - Error tracking
- [ ] Internal traces:
  - Distributed tracing across services
  - Span naming conventions
- [ ] Alerting:
  - Internal incidents for system health
  - Anomaly detection on key metrics

**Output:** `docs/engineering/observability.md`
