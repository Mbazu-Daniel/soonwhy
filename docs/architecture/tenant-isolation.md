# Soonwhy — Tenant Isolation

## Overview

Soonwhy is multi-tenant. Organizations share compute and storage infrastructure but must never see each other's data. This document defines the isolation guarantees across every layer of the stack: PostgreSQL, ClickHouse, NATS JetStream, API scoping, and cold storage.

Isolation is enforced at three levels: **application middleware** (injects `org_id` into every request context), **database policies** (RLS in PostgreSQL, sort-key partitioning in ClickHouse), and **topic scoping** (`org_id` in all NATS subjects). No single layer is trusted alone — each backs up the others.

---

## 1. PostgreSQL Row-Level Security (RLS)

All organizations share a single PostgreSQL instance. Tenant isolation is enforced by RLS policies on every table that stores org-scoped data.

### 1.1 Schema Convention

Every tenant-scoped table includes an `org_id uuid` column:

```sql
CREATE TABLE projects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### 1.2 RLS Policy

Enable RLS and add a blanket policy that checks the session setting `app.org_id`:

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON projects
  USING (org_id = current_setting('app.org_id')::uuid);
```

The same pattern is applied to every org-scoped table: `members`, `api_keys`, `analysis_results`, `notification_preferences`, `billing_usage`, etc.

### 1.3 Middleware: Setting the Session Variable

Every database connection is wrapped by a middleware that sets the session variable before any query executes:

```typescript
// TenantContextMiddleware (NestJS guard)
async canActivate(context: ExecutionContext) {
  const request = context.switchToHttp().getRequest();
  const orgId = request.org_id; // set by auth middleware

  // Set RLS session variable on every connection from pool
  await this.db.execute(
    sql`SELECT set_config('app.org_id', ${orgId}, true)`
  );

  return true;
}
```

The third argument (`true`) scopes the setting to the current transaction only, so connections returned to the pool leak no state.

### 1.4 Safety Net

RLS is a safety net, not the primary filter. The application still adds `WHERE org_id = ?` to every query. This means:

- If a developer forgets the `WHERE` clause, RLS silently filters the result.
- If a raw SQL query bypasses the ORM, RLS still applies.
- A bug that sets the wrong `org_id` in the session variable is caught by the application-level check.

### 1.5 Connection Pooling

Each service uses a connection pool (pg-pool / Drizzle). Connections are checked out, the middleware sets `app.org_id`, the transaction runs, and the connection is returned. The pool ensures no cross-request state leakage.

---

## 2. org_id Propagation

`org_id` flows through every layer of the system. No service makes a storage or messaging decision without it.

### 2.1 Origin: Authentication

The `org_id` is established at authentication time:

| Source | How org_id is resolved |
|--------|----------------------|
| JWT | `org_id` claim in the signed JWT payload |
| API key | Foreign key lookup: `api_keys.org_id` |
| Session token | Resolved via user's org membership |

Auth middleware attaches `org_id` to the request context (`request.org_id`).

### 2.2 Propagation Through Services

```
SDK → API Service → org_id from API key
                    ↓
         Ingestion Worker → org_id in NATS message header
                    ↓
         Processor Worker → org_id written to ClickHouse columns
                    ↓
         AI Worker → org_id filtered in ClickHouse queries
                    ↓
         Scheduler → org_id scoped in migration tasks
```

Every service reads `org_id` from the incoming NATS message or HTTP request context. No service constructs a query or message without it.

### 2.3 Propagation Through NATS

All NATS messages carry `org_id` in the message envelope:

```typescript
interface NatsMessage {
  id: string;
  timestamp: Date;
  org_id: string;       // always present
  project_id?: string;
  payload: any;
  metadata?: Record<string, any>;
}
```

Subscribers validate that `org_id` is present and non-empty before processing.

---

## 3. ClickHouse Tenant Isolation

ClickHouse has no native RLS. Isolation is enforced by sort-key design and application-level query construction.

### 3.1 Sort Key: org_id Leads

Every ClickHouse table places `org_id` as the first column in the `ORDER BY` key:

```sql
-- All tables follow this pattern
ORDER BY (org_id, project_id, service_name, timestamp, ...)
```

This gives two isolation properties:

1. **Query pruning:** ClickHouse skips data blocks where `org_id` doesn't match. Queries without `org_id` scan everything — queries with it scan only that org's granules.
2. **Natural partitioning:** Data from different orgs is physically separated on disk within each partition.

### 3.2 Application-Level Filter

Every ClickHouse query includes a `WHERE org_id = ?` clause. The API Service, AI Worker, and Processor Worker all construct queries with the org filter:

```sql
SELECT * FROM logs
WHERE org_id = 'org_abc'
  AND project_id = 'proj_123'
  AND timestamp >= now() - INTERVAL 1 HOUR;
```

No ClickHouse query is executed without an `org_id` filter. This is enforced by a shared query-builder utility that takes `org_id` as a required parameter.

### 3.3 Materialized Views

All materialized views carry `org_id` in their `ORDER BY` key and in their output schema. The fan-out from `telemetry_events` to `logs`, `metrics`, `traces`, etc. preserves `org_id` on every row.

### 3.4 ClickHouse User Permissions

ClickHouse runs with a single service account for writes (Processor Worker) and a separate read-only account for queries (API Service, AI Worker). Neither account has `SYSTEM` or `DROP` privileges. This prevents a compromised service from altering table schemas or accessing other orgs' data via administrative commands.

---

## 4. NATS Topic Isolation

NATS JetStream topics encode `org_id` in the subject hierarchy, providing logical isolation at the messaging layer.

### 4.1 Topic Structure

```
telemetry.raw.{org_id}.{project_id}
telemetry.processed.{org_id}.{project_id}
ai.analysis.request.{org_id}
ai.analysis.result.{org_id}
ai.analysis.evidence.{org_id}.{analysis_id}
notifications.alert.{org_id}
notifications.billing.{org_id}
notifications.usage.{org_id}
```

### 4.2 Stream Configuration

JetStream streams use wildcard subscriptions (`telemetry.raw.*.*`) for horizontal scaling. Individual consumers filter by `org_id` in their subscription filter:

```typescript
// Processor Worker subscription
const sub = jetstream.subscribe('telemetry.raw.*.*', {
  filter: (msg) => msg.subject.includes(orgId),
});
```

### 4.3 Publisher Constraints

Publishers must include `org_id` in both the subject name and the message body. The Ingestion Worker validates this before publishing:

```typescript
// Before publish
if (!orgId || !isValidUuid(orgId)) {
  throw new Error('Missing or invalid org_id');
}

const subject = `telemetry.raw.${orgId}.${projectId}`;
await jetstream.publish(subject, message);
```

### 4.4 Consumer Isolation

Services subscribe only to topics for their own org (or all orgs if running as a shared worker). The AI Worker, for example, subscribes to `ai.analysis.request.{org_id}` for the org it's serving, not to `ai.analysis.request.*`.

---

## 5. API Key Scoping

API keys are bound to a single organization and optionally scoped to specific permissions.

### 5.1 Key Binding

Each API key has a foreign key to `organizations`:

```sql
api_keys
  id        uuid PK
  org_id    uuid FK → organizations.id  -- immutable after creation
  name      text
  prefix    text                         -- first 8 chars for lookup
  key_hash  text                         -- SHA-256
  scopes    text[]                       -- permission set
  expires_at timestamptz
```

### 5.2 Scopes

API keys can be scoped to specific actions:

| Scope | Grants |
|-------|--------|
| `telemetry:write` | Submit telemetry events |
| `telemetry:read` | Query telemetry data |
| `projects:read` | List projects |
| `projects:write` | Create/update projects |
| `admin` | Full access (billing, API key management) |

### 5.3 Validation Flow

1. Extract prefix from `Authorization: Bearer sw_<prefix><random>`.
2. Look up `api_keys` by `(prefix, org_id)`.
3. Hash the full key, compare with `key_hash`.
4. Check `expires_at` is in the future.
5. Check the required scope is in `scopes`.
6. Attach `org_id` and `scopes` to request context.

### 5.4 Key Revocation

Deleted keys are immediately invalid. The lookup step (2) fails and returns `401 Unauthorized`. There is no grace period.

---

## 6. Cross-Tenant Query Prevention

Multiple safeguards prevent one org from accessing another org's data.

### 6.1 PostgreSQL: RLS + Middleware

- RLS policies filter rows by `org_id` from the session variable.
- Application middleware adds `WHERE org_id = ?` to all ORM queries.
- Raw SQL queries (migrations, admin scripts) must explicitly set `app.org_id`.
- Drizzle ORM schemas always include `orgId` in the where clause builder.

### 6.2 ClickHouse: Sort Key + Filter

- All queries require `org_id` in the `WHERE` clause.
- The sort key ensures ClickHouse only scans the relevant org's data.
- A shared query builder enforces `org_id` as a required parameter — code that omits it won't compile.

### 6.3 NATS: Topic Scoping

- Messages are published to org-scoped topics.
- Consumers filter by `org_id` in the subscription.
- A message from org A cannot arrive on org B's topic.

### 6.4 Cold Storage: Path Isolation

Parquet files on R2 are organized by `org_id`:

```
s3://soonwhy-cold/{org_id}/{project_id}/{date}/{table}.parquet
```

Access is controlled by IAM policies. A service scoped to org A cannot read org B's path without explicit cross-org credentials (which are never issued).

### 6.5 Testing Isolation

Integration tests verify cross-tenant isolation:

```typescript
it('should not return data from another org', async () => {
  const orgA = await createOrg('org-a');
  const orgB = await createOrg('org-b');

  await ingestTelemetry(orgA, { type: 'log', message: 'secret-a' });
  await ingestTelemetry(orgB, { type: 'log', message: 'secret-b' });

  // Query as org A — should only see org A's data
  const result = await queryTelemetry(orgA);
  expect(result.logs).toHaveLength(1);
  expect(result.logs[0].message).toBe('secret-a');
});
```

Tests are run with RLS enabled in the test database to catch any middleware bypass.

---

## 7. Data Residency Considerations

### 7.1 Current Model

All data for all organizations lives in the same region (US-east for Cloudflare R2, or the ClickHouse cluster's deployment region). There is no per-org data residency requirement today.

### 7.2 Future Considerations

If data residency requirements emerge (e.g., GDPR, customer contracts):

| Approach | When to Use |
|----------|-------------|
| **Region-locked orgs** | Org metadata includes `region` flag; data routed to region-specific ClickHouse/R2 instances |
| **Namespace prefixing** | `org_id` already partitions data; adding a region prefix to paths and topics is non-breaking |
| **Separate clusters** | Enterprise customers get isolated ClickHouse/PG instances; requires connection pool changes |

### 7.3 Backup and Recovery

Backups are org-scoped by default. A point-in-time restore restores a single org's data without affecting others. R2 lifecycle policies and ClickHouse TTLs operate independently per partition (which is already date-partitioned and org-scoped via sort key).

---

## 8. Noisy Neighbor Mitigation

Shared infrastructure means one org's traffic can affect another's performance.

### 8.1 Rate Limiting

Per-org and per-key rate limits are enforced at the API layer using Redis sliding-window counters:

| Scope | Free | Pro | Enterprise |
|-------|------|-----|------------|
| Per API key | 60 req/min | 600 req/min | 6,000 req/min |
| Per org | 300 req/min | 3,000 req/min | 30,000 req/min |

### 8.2 ClickHouse Resource Limits

```sql
-- Per-query memory limit
SET max_memory_usage = 10000000000; -- 10GB per query

-- Per-query timeout
SET max_execution_time = 30; -- 30 seconds
```

Queries are killed if they exceed these limits, preventing a single org from monopolizing ClickHouse resources.

### 8.3 NATS Backpressure

The Ingestion Worker drops events when the NATS queue is full. This prevents a high-volume org from blocking ingestion for all other orgs. Dropped events are logged and counted for billing.

### 8.4 Connection Pool Limits

PostgreSQL connection pools are sized per-service, not per-org. High-volume orgs may cause connection contention. Mitigation: monitor connection wait times per org, and consider separate pools for enterprise orgs if needed.

---

## Summary

| Layer | Isolation Mechanism | Enforcement |
|-------|-------------------|-------------|
| PostgreSQL | RLS policies + `app.org_id` session variable | Database-level |
| Application | `WHERE org_id = ?` on every query | Middleware + query builder |
| ClickHouse | `org_id` in sort key + query filter | Application-level |
| NATS | `org_id` in topic name + message body | Publisher + consumer |
| API Keys | Foreign key to `org_id` + scope check | Auth middleware |
| Cold Storage | `org_id` in R2 path + IAM policies | Storage-level |
| Rate Limiting | Per-org + per-key counters | Redis sliding window |
