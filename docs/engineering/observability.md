# Soonwhy — Observability Strategy

## Overview

Soonwhy monitors itself. The platform ingests telemetry from its own infrastructure — API servers, ingestion workers, background processors — using the same `@soonwhy/sdk` that customers use. This dogfooding approach ensures the SDK stays battle-tested and the team experiences the same observability surface as customers.

---

## Self-Instrumentation with @soonwhy/sdk

Every internal service imports `@soonwhy/sdk` and instruments critical paths:

```typescript
import { SoonWhy } from "@soonwhy/sdk";

const sw = new SoonWhy({
  apiKey: process.env.SW_API_KEY,
  endpoint: process.env.SW_ENDPOINT,
  service: "api-gateway", // or "ingestion-worker", "query-service", etc.
});

// Structured log
sw.log("info", "request.received", {
  method: "POST",
  path: "/v1/ingest",
  requestId,
});

// Trace span
await sw.span("db.query", async () => {
  return await clickhouse.query(sql);
});
```

### Instrumentation Points

| Service | Instrumented | What |
|---------|-------------|------|
| API Gateway | Yes | Request latency, error rates, route-level metrics |
| Ingestion Worker | Yes | Batch processing time, queue depth, throughput |
| Query Service | Yes | ClickHouse query latency, cache hit rate |
| Auth Service | Yes | Token validation latency, failure rate |
| Background Jobs | Yes | Job execution time, retry counts |

---

## Key Metrics

Four signals, derived from the RED/USE method.

### Latency

| Metric | Type | Labels |
|--------|------|--------|
| `http_request_duration_ms` | Histogram | method, route, status |
| `ingestion_batch_duration_ms` | Histogram | worker_id |
| `clickhouse_query_duration_ms` | Histogram | query_type, table |
| `nats_publish_duration_ms` | Histogram | subject |

Percentiles: p50, p95, p99 — always. Mean alone is misleading.

### Error Rate

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | Counter | method, route, status |
| `ingestion_errors_total` | Counter | error_type, stage |
| `worker_processing_errors_total` | Counter | error_type |

Error rate = `errors_total / requests_total` over a 5-minute window. Alert when > 1% for 10 minutes.

### Throughput

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_per_second` | Gauge | route |
| `events_ingested_per_second` | Gauge | org_id |
| `nats_messages_per_second` | Gauge | subject |
| `clickhouse_queries_per_second` | Gauge | query_type |

### Saturation

| Metric | Type | Labels |
|--------|------|--------|
| `worker_queue_depth` | Gauge | worker_id |
| `redis_memory_usage_bytes` | Gauge | instance |
| `redis_connections_active` | Gauge | instance |
| `nats_consumer_lag` | Gauge | consumer, subject |
| `clickhouse_connections_active` | Gauge | pool |
| `cpu_usage_percent` | Gauge | service, instance |
| `memory_usage_percent` | Gauge | service, instance |

---

## Structured Logging

All logs are JSON. No plaintext logs in production.

### Log Entry Schema

```json
{
  "level": "info",
  "message": "Ingestion batch processed",
  "service": "ingestion-worker",
  "timestamp": "2026-08-25T10:30:00.000Z",
  "requestId": "req_abc123",
  "userId": "usr_def456",
  "orgId": "org_ghi789",
  "data": {
    "batchId": "batch_xyz",
    "eventCount": 142,
    "durationMs": 230
  }
}
```

### Log Levels

| Level | When | Examples |
|-------|------|----------|
| `error` | System failure requiring immediate attention | DB connection lost, ingestion pipeline down |
| `warn` | Recoverable issue, degraded function | Retry triggered, cache miss spike, rate limit hit |
| `info` | Business events, state transitions | Batch processed, user signed in, deployment completed |
| `debug` | Diagnostic detail, off in production | SQL queries, cache lookups, internal state |

### Rules

- **Request context is mandatory.** Every log within a request boundary must include `requestId`, `orgId` (if available), `userId` (if available).
- **Log once per layer.** Don't bubble-log. Log at the boundary where the event is meaningful.
- **Never log secrets.** API keys, tokens, passwords, PII are redacted or omitted.
- **Error logs include cause chain.** For `ExternalServiceError` and wrapped errors, log the full `cause` hierarchy.

---

## Distributed Tracing

Trace requests across service boundaries using OpenTelemetry-compatible spans.

### Span Naming Convention

```
{service}.{operation}
```

| Span Name | Service | Operation |
|-----------|---------|-----------|
| `api-gateway.http.request` | API Gateway | Incoming HTTP request |
| `api-gateway.route.match` | API Gateway | Route resolution |
| `ingestion-worker.batch.process` | Ingestion Worker | Process a batch of events |
| `ingestion-worker.event.validate` | Ingestion Worker | Validate a single event |
| `query-service.clickhouse.query` | Query Service | Execute ClickHouse query |
| `auth-service.token.validate` | Auth Service | Validate JWT / API key |
| `nats.publish` | Any | Publish message to NATS |
| `nats.consume` | Any | Consume message from NATS |

### Span Attributes

Every span carries:

| Attribute | Description |
|-----------|-------------|
| `service.name` | Service identifier |
| `service.version` | Deployed version |
| `trace.id` | Distributed trace ID |
| `span.id` | Span ID |
| `parent.span.id` | Parent span ID (for child spans) |
| `http.method` | HTTP method (for HTTP spans) |
| `http.status_code` | HTTP status (for HTTP spans) |
| `http.route` | Route pattern (for HTTP spans) |
| `db.system` | Database system (for DB spans) |
| `db.statement` | SQL or query (for DB spans) |
| `error` | Boolean, true if span represents an error |

### Context Propagation

- **HTTP:** `traceparent` header (W3C Trace Context)
- **NATS:** Message header `traceparent`
- **Internal:** AsyncLocalStorage-based context through the request lifecycle

---

## Alerting Rules

### Critical (Page Immediately)

| Alert | Condition | Duration | Action |
|-------|-----------|----------|--------|
| `HighErrorRate` | error rate > 5% | 5 min | Page on-call |
| `IngestionPipelineDown` | ingestion throughput = 0 | 2 min | Page on-call |
| `ClickHouseUnreachable` | connection failures > 0 | 1 min | Page on-call |
| `RedisMemoryCritical` | memory usage > 90% | 5 min | Page on-call |

### Warning (Notify, Don't Page)

| Alert | Condition | Duration | Action |
|-------|-----------|----------|--------|
| `ElevatedErrorRate` | error rate > 1% | 10 min | Slack notification |
| `HighLatency` | p99 latency > 2s | 10 min | Slack notification |
| `QueueDepthHigh` | worker queue > 10,000 | 5 min | Slack notification |
| `NatsConsumerLag` | lag > 5,000 messages | 10 min | Slack notification |
| `RedisMemoryWarning` | memory usage > 75% | 15 min | Slack notification |

### Info (Dashboard Only)

| Alert | Condition | Duration | Action |
|-------|-----------|----------|--------|
| `UnusualTrafficSpike` | throughput > 2x baseline | 15 min | Dashboard annotation |
| `CacheHitRateLow` | hit rate < 80% | 30 min | Dashboard annotation |

### Anomaly Detection

For key metrics (latency, throughput, error rate), use a rolling 7-day baseline. Alert when current value deviates by > 2 standard deviations from the expected range for the same time-of-day pattern.

---

## Dashboard Requirements

### Overview Dashboard

Single-pane view of system health.

| Panel | Metric | Visualization |
|-------|--------|---------------|
| Request Rate | `http_requests_per_second` | Time series, by route |
| Error Rate | `errors_total / requests_total` | Time series, percentage |
| Latency (p50/p95/p99) | `http_request_duration_ms` | Time series, percentile lines |
| Active Orgs | Unique `orgId` in last 5 min | Single stat |
| Ingestion Rate | `events_ingested_per_second` | Time series |
| Queue Depth | `worker_queue_depth` | Time series, by worker |

### Service Dashboards

One per service (API Gateway, Ingestion Worker, Query Service, Auth Service).

| Panel | Metric |
|-------|--------|
| Request breakdown | By route, method, status |
| Latency heatmap | Duration distribution |
| Error breakdown | By error type |
| Resource usage | CPU, memory, connections |
| Dependency health | Upstream latency, error rates |

### Infrastructure Dashboard

| Panel | Metric |
|-------|--------|
| Redis | Memory, connections, hit rate, evictions |
| ClickHouse | Query rate, query latency, parts count, replication lag |
| NATS | Message rate, consumer lag, connection count |
| Kubernetes | Pod count, restarts, OOM kills |

### Dashboard Conventions

- Time range default: last 1 hour, zoomable to 30 days
- Auto-refresh: 30 seconds for overview, 60 seconds for detail
- Color coding: green (healthy), yellow (warning), red (critical)
- Annotations for deployments, incidents, config changes

---

## On-Call Playbook

### Severity Classification

| Severity | Response Time | Examples |
|----------|--------------|----------|
| P0 — Critical | 5 min | Total outage, data loss, security breach |
| P1 — High | 15 min | Major feature degraded, ingestion failing |
| P2 — Medium | 1 hour | Minor feature degraded, elevated error rate |
| P3 — Low | Next business day | Cosmetic issues, non-urgent optimizations |

### Incident Response Flow

1. **Acknowledge** — Respond to alert within SLA. Confirm you're on it.
2. **Assess** — Open the overview dashboard. Identify which service and metric is affected.
3. **Mitigate** — Stop the bleeding. Roll back if recent deploy. Scale up if load-related.
4. **Diagnose** — Use logs (filter by `requestId`), traces, and dashboards to find root cause.
5. **Resolve** — Fix the issue. Verify on dashboards that metrics return to normal.
6. **Post-mortem** — For P0/P1 incidents, write a blameless post-mortem within 48 hours.

### Common Scenarios

#### Ingestion Pipeline Slow

1. Check `worker_queue_depth` — is it growing?
2. Check `ingestion_batch_duration_ms` — are batches taking longer?
3. Check ClickHouse write latency — is the sink slow?
4. Check NATS consumer lag — is the pipeline backed up?
5. Scale workers horizontally if queue depth is the bottleneck.

#### Elevated API Error Rate

1. Check which routes are returning 5xx.
2. Filter logs by `level=error` and the affected route.
3. Check if a recent deploy correlates with the spike.
4. Check upstream dependencies (ClickHouse, Redis, NATS).
5. Roll back if deploy-related, or restart the affected service.

#### High Latency

1. Check p50 vs p99 — is it a tail latency issue or systemic?
2. Check slow queries in ClickHouse dashboard.
3. Check Redis for slow operations or connection pool exhaustion.
4. Check if a specific org is generating disproportionate load.
5. Consider rate limiting or query optimization.

#### Redis Memory Critical

1. Check `redis_memory_usage_bytes` trend — gradual or sudden?
2. Check for key expiration issues (TTL misconfiguration).
3. Check for connection leaks (active connections > expected).
4. Evict stale keys manually if needed, then investigate root cause.

### Escalation Path

| Level | Contact | When |
|-------|---------|------|
| On-call engineer | Rotating weekly | First responder |
| Tech lead | Slack DM | Unresolved after 30 min |
| CTO | Phone | Unresolved after 1 hour, P0 only |

### Communication Template

During incidents, post in `#incidents`:

```
**[P{level}] {title}**
Status: Investigating | Mitigating | Resolved
Impact: {description}
Started: {time}
Updates: {next update time}
```

---

## Implementation Checklist

- [ ] Instrument API Gateway with `@soonwhy/sdk`
- [ ] Instrument Ingestion Worker with `@soonwhy/sdk`
- [ ] Instrument Query Service with `@soonwhy/sdk`
- [ ] Instrument Auth Service with `@soonwhy/sdk`
- [ ] Define SLIs/SLOs for each service
- [ ] Create overview dashboard
- [ ] Create per-service dashboards
- [ ] Create infrastructure dashboard
- [ ] Configure alerting rules
- [ ] Set up on-call rotation
- [ ] Write runbooks for each alert
- [ ] Schedule first game day
