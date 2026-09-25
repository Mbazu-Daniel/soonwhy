# Production Reliability and Capacity

7C keeps the control plane deterministic and makes overload and dependency failures visible instead of silently accepting work.

## Capacity controls

### Ingest

- `INGEST_MAX_CONCURRENCY`: maximum concurrent OTLP requests handled by one ingest process. Default: 100.
- `INGEST_MAX_CONCURRENCY_PER_ORG`: maximum concurrent OTLP requests for one organization on one ingest process. Default: 25 when the global limit is 100.
- Saturated requests receive HTTP 503 with `Retry-After: 1`.
- Rate-limited organizations receive HTTP 429 with `Retry-After: 1`.
- `NATS_MAX_ACK_PENDING` controls JetStream consumer backpressure.
- Horizontal ingest scaling is supported by running multiple ingest instances against the same NATS stream and durable consumers.

### API database pool

- `DB_POOL_MAX`: maximum PostgreSQL connections per API process. Default: 20.
- `DB_IDLE_TIMEOUT_SECONDS`: idle connection timeout. Default: 20.
- `DB_CONNECT_TIMEOUT_SECONDS`: connection establishment timeout. Default: 10.
- `DB_MAX_LIFETIME_SECONDS`: maximum connection lifetime. Default: 1800.

Pool limits should be sized against the database total connection budget when increasing API replicas.

## Health checks

- API `/health/live` checks process liveness only.
- API `/health/ready` verifies PostgreSQL connectivity.
- Ingest `/health` reports NATS readiness and request capacity.

## Migration safety

Run migrations before routing traffic to a deployment that depends on new schema objects. CI validates migration ordering and duplicate database-object declarations.

## Disaster recovery

Restore PostgreSQL into an isolated target, run migrations and representative application checks, verify health/readiness, then reconnect workers and route traffic gradually. RPO/RTO values should come from the deployed backup and infrastructure schedule rather than hard-coded application constants.

## Backup restore drill

Run:

```bash
SOURCE_DATABASE_URL='postgres://...' RESTORE_DATABASE_URL='postgres://...' bash scripts/backup-restore-drill.sh
```

The target must be isolated because the drill drops and recreates its `public` schema. The drill verifies organizations, projects, detection runs, investigation cases, usage events, and billing events.

## Load validation

Run `SOONWHY_API_KEY=... pnpm --filter @soonwhy/ingest load-test` for a real HTTP load test. Set `INGEST_URLS` to a comma-separated list to distribute requests across multiple ingest instances. The test reports per-target success, 429, 503, failures, and p50/p95/p99 latency.
