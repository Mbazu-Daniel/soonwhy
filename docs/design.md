# SoonWhy — System Design

## Overview

SoonWhy is an AI-powered observability platform. Developers install an SDK, send telemetry, and get AI-driven root-cause analysis with evidence-gated responses.

```
┌─────────────────────────────────────────────────────────────┐
│                        USER APP                             │
│                                                             │
│   @soonwhy/sdk                                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│   │ Batching  │  │ Retry    │  │ Fail-Open│                 │
│   │ Buffer    │  │ Backoff  │  │ Silent   │                 │
│   └────┬─────┘  └────┬─────┘  └──────────┘                 │
│        │              │                                     │
│   ┌────┴──────────────┴────┐                                │
│   │   Transport (HTTP)     │                                │
│   │   POST /v1/ingest      │                                │
│   └────────────┬───────────┘                                │
└────────────────┼────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (NestJS)                         │
│                                                             │
│   ┌─────────────────────────────────────────────────┐      │
│   │              Ingestion Gateway                   │      │
│   │  POST /v1/ingest                                │      │
│   │  • API Key auth → project → org                 │      │
│   │  • Zod validation (per event type)              │      │
│   │  • Rate limiting (per project)                  │      │
│   └────────────────────┬────────────────────────────┘      │
│                        │                                    │
│   ┌────────────────────▼────────────────────────────┐      │
│   │              NATS JetStream                      │      │
│   │  Topics: ingest.{orgId}.{type}                  │      │
│   │  Retention: 24h                                 │      │
│   └────┬──────────┬──────────┬──────────┬───────────┘      │
│        │          │          │          │                    │
│   ┌────▼───┐ ┌────▼───┐ ┌────▼───┐ ┌────▼───┐             │
│   │ logs   │ │metrics │ │ errors │ │requests│ ...           │
│   └────┬───┘ └────┬───┘ └────┬───┘ └────┬───┘             │
│        │          │          │          │                    │
│   ┌────▼──────────▼──────────▼──────────▼───────────┐      │
│   │           Ingestion Consumer                     │      │
│   │  • Batch (100 events or 5s)                     │      │
│   │  • Write to ClickHouse                          │      │
│   └────────────────────┬────────────────────────────┘      │
│                        │                                    │
│   ┌────────────────────▼────────────────────────────┐      │
│   │              ClickHouse                          │      │
│   │  Tables: logs, metrics, errors, requests, traces│      │
│   │  Partition: YYYYMM                              │      │
│   │  TTL: 7 days → R2                               │      │
│   └────────────────────┬────────────────────────────┘      │
│                        │                                    │
│   ┌────────────────────▼────────────────────────────┐      │
│   │        Cold Storage (Daily Cron)                 │      │
│   │  ClickHouse → Parquet → R2                      │      │
│   │  Path: s3://soonwhy/{org}/{type}/{date}.parquet │      │
│   └─────────────────────────────────────────────────┘      │
│                                                             │
│   ┌─────────────────────────────────────────────────┐      │
│   │              CRUD Modules                        │      │
│   │  Auth │ Orgs │ Projects │ Environments │ Services │     │
│   │  API Keys │ Health │ Redis                      │      │
│   └─────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture Decisions

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Backend | NestJS + TypeScript | Single language, modular, strong DI |
| ORM | Drizzle | Type-safe, SQL-like, lightweight |
| Auth | Better Auth | Open-source, org plugin, email + OAuth |
| Database | PostgreSQL (RLS) | Multi-tenant isolation at DB level |
| Hot Storage | ClickHouse (self-hosted) | 10-100x faster for analytics than PG |
| Cold Storage | Cloudflare R2 + Parquet | Cheap, durable, queryable via DuckDB |
| Queue | NATS JetStream | Lightweight, at-least-once, 24h retention |
| Frontend | TanStack Start + React | SSR, file-based routing, type-safe |
| UI | shadcn/ui + Tailwind | Copy-paste components, no runtime |
| Monorepo | pnpm workspaces + Turborepo | Fast builds, strict dependency graph |
| Linting | oxlint + oxfmt | Fast, Rust-based |
| Testing | vitest | Fast, ESM-native |

---

## Data Model

### PostgreSQL (via Drizzle)

```
organizations
  id (UUIDv7)
  name, slug, logo, metadata
  created_at, updated_at

users (managed by Better Auth)
  id, email, name, image, emailVerified
  created_at, updated_at

accounts (managed by Better Auth)
  id, userId, providerId, providerUserId, passwordHash
  accessToken, refreshToken

sessions (managed by Better Auth)
  id, userId, ipAddress, userAgent, expiresAt

projects
  id (UUIDv7)
  org_id → organizations.id (CASCADE)
  name, slug, description
  created_at, updated_at

environments
  id (UUIDv7)
  project_id → projects.id (CASCADE)
  name, slug
  created_at

services
  id (UUIDv7)
  project_id → projects.id (CASCADE)
  name, slug
  created_at

api_keys
  id (UUIDv7)
  org_id → organizations.id (CASCADE)
  name, prefix, keyHash, scopes, expiresAt, lastUsedAt
  created_at
```

### ClickHouse (5 tables)

```sql
-- All tables share this structure:
CREATE TABLE {type} (
  id String,
  timestamp DateTime64(3),
  org_id String,
  project_id String,
  service String DEFAULT '',
  -- type-specific columns --
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, service, timestamp)
TTL timestamp + INTERVAL 7 DAY DELETE
```

| Table | Additional Columns |
|-------|-------------------|
| logs | level, message, attributes, stackTrace |
| metrics | name, value, unit |
| errors | errorType, errorMessage, stack, fingerprint |
| requests | method, url, statusCode, duration, userAgent, ip |
| traces | traceId, spanId, parentSpanId, name, duration |

---

## API Design

### Ingestion

```
POST /v1/ingest
Authorization: Bearer sk_{projectId}_{secret}
Content-Type: application/json

{
  "batch": [
    {
      "id": "uuid",
      "timestamp": 1234567890,
      "type": "log",
      "projectId": "auto-from-key",
      "service": "api-gateway",
      "data": { "level": "info", "message": "Request handled" }
    }
  ]
}

Response: { "accepted": 1, "rejected": 0 }
```

### CRUD (Phase 1)

```
Auth:
  POST /api/auth/sign-up
  POST /api/auth/sign-in
  POST /api/auth/sign-out
  GET  /api/auth/session

Organizations:
  POST   /api/organizations
  GET    /api/organizations
  GET    /api/organizations/:id
  PUT    /api/organizations/:id
  DELETE /api/organizations/:id
  GET    /api/organizations/:id/members
  POST   /api/organizations/:id/members
  DELETE /api/organizations/:id/members/:userId

Projects:
  POST   /api/projects
  GET    /api/projects
  GET    /api/projects/:id
  PUT    /api/projects/:id
  DELETE /api/projects/:id

Environments:
  POST   /api/environments
  GET    /api/environments
  GET    /api/environments/:id
  DELETE /api/environments/:id

Services:
  POST   /api/services
  GET    /api/services
  GET    /api/services/:id
  DELETE /api/services/:id

API Keys:
  POST   /api/api-keys
  GET    /api/api-keys
  DELETE /api/api-keys/:id

Health:
  GET /api/health
  GET /api/health/live
  GET /api/health/ready
```

---

## SDK Design

```typescript
import { init } from '@soonwhy/sdk';

const sdk = init({
  apiKey: process.env.SOONWHY_API_KEY,
});

// Manual capture
sdk.captureLog({ level: 'info', message: 'Server started' });
sdk.captureError({ errorType: 'TypeError', errorMessage: 'Cannot read property' });
sdk.captureMetric({ name: 'http.request.duration', value: 145, unit: 'ms' });

// Auto-instrumentation (opt-in)
import { autoInstrumentHttp } from '@soonwhy/sdk/auto/http';
import { autoInstrumentDb } from '@soonwhy/sdk/auto/db';
autoInstrumentHttp(sdk);
autoInstrumentDb(sdk);
```

### Behavior

- **Batching**: Events buffered in memory, flushed every 5s or when batch reaches 100 events
- **Retry**: Exponential backoff (1s, 2s, 4s...), max 3 retries
- **Fail-open**: If Soonwhy is unreachable, events are silently dropped — never crashes the host app
- **Shutdown**: Flush on `process.exit`, `SIGINT`, `SIGTERM`

---

## Multi-Tenancy

All data is scoped to `org_id`:
- PostgreSQL: RLS policies filter by org
- ClickHouse: `org_id` column on all tables
- NATS: Topics namespaced by org (`ingest.{orgId}.{type}`)
- SDK: API key maps to project → org

---

## Deployment

```
Dokploy VPS
├── Docker Compose
│   ├── ClickHouse (port 8123)
│   ├── NATS (ports 4222, 6222, 8222)
│   └── PostgreSQL (port 5432) [or Neon]
├── SoonWhy API (NestJS)
├── SoonWhy UI (TanStack Start)
└── Cloudflare R2 (cold storage)
```

---

## File Structure

```
soonwhy/
├── apps/
│   ├── api/                    # NestJS backend
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── nats/           # NATS JetStream
│   │       ├── clickhouse/     # ClickHouse + migrations
│   │       ├── auth/           # Better Auth
│   │       ├── common/         # Guards, middleware, decorators
│   │       ├── db/             # Drizzle schemas
│   │       ├── redis/          # Redis
│   │       └── modules/v1/     # Feature modules
│   │           ├── ingestion/  # POST /v1/ingest
│   │           ├── cold-storage/ # R2 migration
│   │           ├── organizations/
│   │           ├── projects/
│   │           ├── environments/
│   │           ├── services/
│   │           ├── api-keys/
│   │           └── health/
│   └── ui/                     # TanStack Start frontend
│       └── app/
│           ├── routes/
│           ├── components/
│           └── styles/
├── packages/
│   ├── shared/                 # Zod schemas + types
│   ├── sdk/                    # @soonwhy/sdk
│   └── tsconfig/               # Shared TS configs
├── docs/
│   └── adr/                    # Architecture Decision Records
└── .scratch/                   # Planning & tickets
```
