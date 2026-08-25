# Deployment Architecture

## Overview

Soonwhy runs on a single VPS using Docker Compose, managed by [Dokploy](https://dokploy.com). All 6 NestJS services, infrastructure services, and the TanStack Start frontend deploy as containers on one host. This keeps costs low while allowing horizontal scaling later.

## Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                         Dokploy (Host)                          │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐            │
│  │   Frontend   │  │  API (x2)  │  │  Ingestion   │            │
│  │ TanStack     │  │  :3000     │  │  Worker (x2) │            │
│  │ Start        │  │            │  │              │            │
│  └──────┬──────┘  └──────┬─────┘  └──────┬───────┘            │
│         │                │               │                      │
│         └────────┬───────┴───────────────┘                      │
│                  │                                              │
│  ┌───────────────┴──────────────────────────────────────────┐   │
│  │                    Docker Bridge Network                 │   │
│  └───┬──────────┬──────────┬──────────┬──────────┬──────────┘   │
│      │          │          │          │          │                │
│  ┌───┴───┐  ┌──┴───┐  ┌───┴───┐  ┌───┴───┐  ┌──┴────┐         │
│  │ NATS  │  │Click │  │Postgre│  │ Redis │  │  R2   │         │
│  │ JetStr│  │House │  │SQL    │  │       │  │(ext)  │         │
│  └───────┘  └──────┘  └───────┘  └───────┘  └───────┘         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│  │ Processor│  │ AI Worker│  │ Scheduler│                     │
│  │ Worker(x2│  │  (x2)   │  │  (x1)   │                     │
│  └──────────┘  └──────────┘  └──────────┘                     │
│                                                                 │
│  ┌──────────────┐                                              │
│  │ Notifications │                                              │
│  │   (x1)       │                                              │
│  └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
   Cloudflare R2 (external cold storage)
```

## Service Placement

### Application Services

| Service | Image | Replicas | Port | Notes |
|---------|-------|----------|------|-------|
| **Frontend** | `soonwhy/frontend` | 1 | 3001 | TanStack Start, SSR |
| **API** | `soonwhy/api` | 2 | 3000 | Load balanced by Dokploy |
| **Ingestion Worker** | `soonwhy/ingestion-worker` | 2 | — | Stateless, high throughput |
| **Processor Worker** | `soonwhy/processor-worker` | 2 | — | Writes to ClickHouse + R2 |
| **AI Worker** | `soonwhy/ai-worker` | 2 | — | LLM call rate limits |
| **Scheduler** | `soonwhy/scheduler` | 1 | — | Leader election for cron |
| **Notifications** | `soonwhy/notifications` | 1 | — | Lowest priority |

### Infrastructure Services

| Service | Image | Port | Data |
|---------|-------|------|------|
| **NATS JetStream** | `nats:2.10-alpine` | 4222 (client), 8222 (monitor) | JetStream streams |
| **ClickHouse** | `clickhouse/clickhouse-server:latest` | 8123 (HTTP), 9000 (native) | Telemetry hot storage |
| **PostgreSQL** | `postgres:16-alpine` | 5432 | Auth, config, analysis results |
| **Redis** | `redis:7-alpine` | 6379 | Rate limiting, caching |

## Network Configuration

All services communicate over a single Docker bridge network (`soonwhy-net`). Dokploy manages DNS resolution via container names.

```
Network: soonwhy-net (bridge, 172.20.0.0/16)

Service DNS names (Docker internal):
  frontend         → frontend:3001
  api              → api:3000
  ingestion-worker → ingestion-worker:3000
  processor-worker → processor-worker:3000
  ai-worker        → ai-worker:3000
  scheduler        → scheduler:3000
  notifications    → notifications:3000
  nats             → nats:4222
  clickhouse       → clickhouse:8123
  postgres         → postgres:5432
  redis            → redis:6379
```

### External Access

- **Frontend:** Port `3001` exposed to host, proxied by Dokploy with SSL termination (Let's Encrypt).
- **API:** Port `3000` exposed to host, proxied by Dokploy with SSL termination. Public endpoint: `https://api.soonwhy.dev`.
- **Ingestion:** Port `3002` exposed for direct SDK connections. Public endpoint: `https://ingest.soonwhy.dev`.
- **NATS Monitor:** Port `8222` internal only (accessible via SSH tunnel if needed).

## Storage Volumes

### Persistent Volumes

| Volume | Mount Path | Contents | Size Estimate |
|--------|-----------|----------|---------------|
| `nats-data` | `/data` | JetStream streams, consumer state | 10 GB |
| `clickhouse-data` | `/var/lib/clickhouse` | Hot telemetry storage | 50-100 GB |
| `clickhouse-logs` | `/var/log/clickhouse-server` | ClickHouse logs | 5 GB |
| `postgres-data` | `/var/lib/postgresql/data` | Auth, config, analysis results | 5-10 GB |
| `redis-data` | `/data` | Rate limit counters, cache | 2-5 GB |

### Volume Mounts (Docker Compose)

```yaml
volumes:
  nats-data:
    driver: local
  clickhouse-data:
    driver: local
  clickhouse-logs:
    driver: local
  postgres-data:
    driver: local
  redis-data:
    driver: local
```

### External Storage (Cloudflare R2)

- **Bucket:** `soonwhy-cold-storage`
- **Format:** Apache Parquet files
- **Lifecycle:** Processor Worker writes daily Parquet files; Scheduler archives and cleans up.
- **Credentials:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

## Environment Variables

### Shared Across All NestJS Services

```bash
# Node
NODE_ENV=production
LOG_LEVEL=info

# NATS
NATS_URL=nats://nats:4222

# Redis
REDIS_URL=redis://redis:6379
```

### Per-Service Variables

**API**
```bash
DATABASE_URL=postgresql://soonwhy:${POSTGRES_PASSWORD}@postgres:5432/soonwhy
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
BETTER_AUTH_BASE_URL=https://api.soonwhy.dev
FRONTEND_URL=https://soonwhy.dev
PORT=3000
```

**Ingestion Worker**
```bash
REDIS_URL=redis://redis:6379
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=60000
```

**Processor Worker**
```bash
CLICKHOUSE_URL=http://clickhouse:8123
CLICKHOUSE_DB=soonwhy
CLICKHOUSE_USER=clickhouse
CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD}
R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
R2_BUCKET_NAME=soonwhy-cold-storage
```

**AI Worker**
```bash
DATABASE_URL=postgresql://soonwhy:${POSTGRES_PASSWORD}@postgres:5432/soonwhy
REDIS_URL=redis://redis:6379
OPENAI_API_KEY=${OPENAI_API_KEY}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
LLM_RATE_LIMIT_MAX=50
LLM_RATE_LIMIT_WINDOW=60000
```

**Scheduler**
```bash
CLICKHOUSE_URL=http://clickhouse:8123
CLICKHOUSE_DB=soonwhy
CLICKHOUSE_USER=clickhouse
CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD}
R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
R2_BUCKET_NAME=soonwhy-cold-storage
DATABASE_URL=postgresql://soonwhy:${POSTGRES_PASSWORD}@postgres:5432/soonwhy
```

**Notifications**
```bash
SENDGRID_API_KEY=${SENDGRID_API_KEY}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL}
```

**Frontend**
```bash
API_URL=https://api.soonwhy.dev
PORT=3001
```

### Secrets Management

Dokploy provides a built-in secrets manager. All sensitive values (`POSTGRES_PASSWORD`, `CLICKHOUSE_PASSWORD`, `BETTER_AUTH_SECRET`, API keys) are stored as Dokploy secrets and injected at deploy time. Never commit secrets to the repository.

## Health Checks

Every container defines a health check. Dokploy uses these for orchestration and restart decisions.

| Service | Check | Interval | Timeout | Retries |
|---------|-------|----------|---------|---------|
| **Frontend** | `CMD curl -f http://localhost:3001/` | 30s | 5s | 3 |
| **API** | `CMD curl -f http://localhost:3000/health` | 15s | 5s | 3 |
| **Ingestion Worker** | `CMD curl -f http://localhost:3000/health` | 15s | 5s | 3 |
| **Processor Worker** | `CMD curl -f http://localhost:3000/health` | 15s | 5s | 3 |
| **AI Worker** | `CMD curl -f http://localhost:3000/health` | 15s | 5s | 3 |
| **Scheduler** | `CMD curl -f http://localhost:3000/health` | 30s | 5s | 3 |
| **Notifications** | `CMD curl -f http://localhost:3000/health` | 30s | 5s | 3 |
| **NATS** | `CMD wget -qO- http://localhost:8222/healthz` | 10s | 5s | 3 |
| **ClickHouse** | `CMD wget -qO- http://localhost:8123/ping` | 10s | 5s | 3 |
| **PostgreSQL** | `CMD pg_isready -U soonwhy` | 10s | 5s | 5 |
| **Redis** | `CMD redis-cli ping` | 10s | 3s | 3 |

Each NestJS service exposes a `/health` endpoint returning:

```json
{
  "status": "ok",
  "services": {
    "nats": "connected",
    "postgres": "connected",
    "redis": "connected",
    "clickhouse": "connected"
  }
}
```

## Scaling Considerations

### Phase 1 — Vertical Scaling (Now)

Single VPS with vertical scaling. Recommended starting spec:

- **CPU:** 4-8 vCPUs
- **RAM:** 16-32 GB
- **Storage:** 200 GB NVMe (expandable)
- **OS:** Ubuntu 22.04 LTS

This handles moderate telemetry volumes with room to grow.

### Phase 2 — Horizontal Scaling (When Needed)

When vertical limits are hit:

1. **API + Ingestion Workers** — Scale to 2-4 replicas behind Dokploy's built-in load balancer. Stateless, so scaling is trivial.
2. **Processor + AI Workers** — Scale to 2-4 replicas. NATS JetStream handles consumer groups automatically.
3. **Scheduler** — Keep at 1 replica. Use leader election or Dokploy's singleton constraint to prevent duplicate cron runs.
4. **Notifications** — Keep at 1 replica unless volume demands otherwise.

### Phase 3 — Multi-Host (Future)

When a single VPS is insufficient:

- Move to multiple VPS nodes managed by Dokploy's Docker Swarm mode.
- Use Docker overlay networks for cross-host communication.
- Consider moving stateful services (ClickHouse, PostgreSQL) to managed providers.

### Phase 4 — Kubernetes (Long-Term)

For high-scale deployments:

- Migrate to Kubernetes with Helm charts.
- Use ClickHouse Operator, CloudNativePG, Redis Operator.
- Use NATS Operator for JetStream.
- Auto-scaling via HPA on CPU/memory metrics.

## Backup Strategy

### PostgreSQL

- Daily automated dump via `pg_dump` to local file, uploaded to R2.
- WAL archiving for point-in-time recovery.
- Retention: 30 days.

### ClickHouse

- Use ClickHouse's `BACKUP` command for full snapshots.
- Daily backups to R2.
- Retention: 7 days.

### NATS JetStream

- JetStream replicates to local disk (file-based storage).
- Snapshot `/data` volume weekly to R2.

### Redis

- RDB snapshots every 15 minutes (default).
- Copy `dump.rdb` to R2 daily.

### R2 (Cold Storage)

- Cloudflare manages durability (11 nines). No additional backup needed.

### Restore Procedure

1. Stop all application services.
2. Restore PostgreSQL from latest dump + WAL replay.
3. Restore ClickHouse from backup.
4. Restart application services.
5. Verify health checks pass.

## SSL/TLS

- Dokploy manages SSL certificates via Let's Encrypt (ACME).
- All public endpoints use HTTPS.
- Internal service-to-service communication is unencrypted (trusted Docker network).
- Future: mTLS between services if compliance requires it.
