# ADR-0006: Telemetry Ingestion Architecture

## Status

Accepted

## Context

Soonwhy needs to receive telemetry data (logs, metrics, errors, requests, traces) from user applications via an SDK, validate it, and store it in ClickHouse for querying. The ingestion pipeline must be reliable, scalable, and cost-efficient.

## Decision

### SDK (`@soonwhy/sdk`)

- Lives in `packages/sdk/` within the monorepo (split to separate repo later)
- Single `POST /v1/ingest` endpoint for all telemetry types
- Batching: events buffered in memory, flushed every 5s or when batch reaches 100 events
- Retry: exponential backoff with jitter, max 3 retries
- Fail-open: if Soonwhy is unreachable, events are dropped silently — never crash the host app
- API key authentication: one key per project, passed as `Authorization: Bearer <key>`
- Auto-instrumentation via opt-in plugins (`@soonwhy/sdk/auto/http`, `@soonwhy/sdk/auto/db`)
- Manual API: `sdk.captureLog()`, `sdk.captureError()`, `sdk.captureMetric()`

### Ingestion Gateway (NestJS module)

- New `IngestionModule` in `apps/api/src/modules/v1/ingestion/`
- Single endpoint: `POST /v1/ingest`
- Validates API key → resolves project → resolves org
- Validates event schema per type
- Publishes to NATS JetStream per-type topics
- Rate limiting: per-project, configurable

### Queue (NATS JetStream on Dokploy)

- Self-hosted on Dokploy (same VPS as ClickHouse)
- Topics: `ingest.{orgId}.{type}` (one per org per type)
- Message retention: 24h (enough for consumer processing)
- Consumer: persistent consumers per org, at-least-once delivery

### Storage (ClickHouse)

- One table per telemetry type: `logs`, `metrics`, `errors`, `requests`, `traces`
- All tables partitioned by `toYYYYMM(timestamp)`
- All tables ordered by `(projectId, service, timestamp)`
- Retention: 7 days in ClickHouse
- `org_id` column on all tables for tenant isolation

### Cold Storage (Cloudflare R2)

- Daily migration: export partitions older than 7 days as Parquet
- Upload to R2 via `@aws-sdk/client-s3` (R2 is S3-compatible)
- R2 path: `s3://soonwhy-telemetry/{orgId}/{type}/{YYYY-MM-DD}.parquet`
- After successful upload, delete partition from ClickHouse

### Telemetry Event Schema

```ts
interface TelemetryEvent {
  id: string;           // client-generated UUIDv7
  timestamp: number;    // epoch ms
  type: 'log' | 'metric' | 'error' | 'request' | 'trace';
  projectId: string;    // derived from API key
  service?: string;     // optional: which service
  data: Record<string, unknown>; // type-specific fields
}
```

Type-specific `data` fields:

| Type | Fields |
|------|--------|
| log | `level`, `message`, `attributes`, `stackTrace` |
| metric | `name`, `value`, `unit` |
| error | `errorType`, `errorMessage`, `stack`, `fingerprint` |
| request | `method`, `url`, `statusCode`, `duration`, `userAgent`, `ip` |
| trace | `traceId`, `spanId`, `parentSpanId`, `name`, `duration` |

## Consequences

### Positive
- Single ingest endpoint simplifies SDK (one HTTP connection, one buffer)
- NATS JetStream provides reliable, ordered delivery with minimal ops
- Per-type ClickHouse tables enable efficient queries (no filtering by type column)
- Daily R2 migration ensures data durability without real-time complexity
- Opt-in auto-instrumentation keeps SDK core tiny
- Fail-open design ensures host app stability

### Negative
- NATS JetStream adds infrastructure to manage
- Daily R2 migration means data is ~24h stale in cold storage
- Per-type NATS topics increase topic count (orgs × types)
- ClickHouse retention must be enforced (partitions deleted after 7 days)

### Mitigation
- NATS runs on Dokploy alongside ClickHouse (single VPS, Docker Compose)
- R2 migration is a simple cron job, not real-time
- Topic count is manageable (100 orgs × 5 types = 500 topics)
- ClickHouse TTL handles retention automatically

## Alternatives Considered

- **BullMQ + Redis**: Already in stack, but less robust for telemetry throughput
- **Split endpoints per type**: More RESTful, but SDK complexity increases (multiple buffers, connections)
- **Kafka**: Overkill for MVP, higher ops cost
- **rclone for R2 migration**: No Parquet conversion, no schema control
- **Full auto-instrumentation (DD-style)**: Monkey-patching causes production incidents, too complex for MVP
