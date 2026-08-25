# Soonwhy — Storage Lifecycle

## Overview

Three-tier storage architecture: ClickHouse for hot data, Cloudflare R2 + Parquet for cold and archive data. Data flows automatically between tiers based on age.

```
┌──────────┐  0-7d   ┌──────────┐  7-90d  ┌──────────┐  90d+   ┌──────────┐
│  ClickHouse│──────▶│  R2 Cold  │──────▶│R2 Archive │──────▶│  Delete  │
│  (Hot)    │        │(Parquet)  │        │(Parquet)  │        │          │
└──────────┘        └──────────┘        └──────────┘        └──────────┘
```

---

## Tier 1: Hot Storage (ClickHouse)

**Retention:** 0–7 days

### Tables

| Table | Primary Key | Partition Key | TTL |
|-------|------------|---------------|-----|
| `logs` | `(org_id, project_id, timestamp, log_id)` | `toYYYYMM(timestamp)` | 7 days |
| `metrics` | `(org_id, project_id, timestamp, metric_name)` | `toYYYYMM(timestamp)` | 7 days |
| `traces` | `(org_id, project_id, timestamp, trace_id)` | `toYYYYMM(timestamp)` | 7 days |
| `spans` | `(org_id, project_id, timestamp, span_id)` | `toYYYYMM(timestamp)` | 7 days |
| `requests` | `(org_id, project_id, timestamp, request_id)` | `toYYYYMM(timestamp)` | 7 days |
| `errors` | `(org_id, project_id, timestamp, error_id)` | `toYYYYMM(timestamp)` | 7 days |

### ClickHouse TTL

```sql
ALTER TABLE logs
  MODIFY TTL timestamp + INTERVAL 7 DAY
  DELETE WHERE timestamp < now() - INTERVAL 7 DAY;
```

### Query Patterns

- Real-time dashboard queries (last 1h, 6h, 24h)
- Live alerts and anomaly detection
- API-backed table/list views
- P95 latency target: < 200ms

---

## Tier 2: Cold Storage (R2 + Parquet)

**Retention:** 7–90 days

### R2 Bucket Structure

```
soonwhy-cold/
└── {org_id}/
    └── {project_id}/
        └── {YYYY-MM-DD}/
            ├── logs.parquet
            ├── metrics.parquet
            ├── traces.parquet
            ├── spans.parquet
            ├── requests.parquet
            └── errors.parquet
```

### Parquet File Naming

```
{event_type}.parquet
```

Single file per type per day per project. No row-group splitting—each file is one logical partition.

### Partition Strategy

Parquet files are partitioned within the file using column statistics:

| Column | Type | Purpose |
|--------|------|---------|
| `org_id` | String (dictionary) | Tenant isolation |
| `project_id` | String (dictionary) | Project scoping |
| `timestamp` | DateTime64(ms) | Time-range pruning |
| `event_type` | String (dictionary) | Signal type |
| `environment_id` | String (dictionary) | Environment filter |

All remaining columns are stored as flat columns—no nested partition directories inside Parquet.

### Compression

```python
# pyarrow settings
pq.write_table(
    table,
    path,
    compression="zstd",
    compression_level=3,
    use_dictionary=True,
    write_statistics=True,
    data_page_version="2.6",
)
```

- **Codec:** zstd (level 3) — best ratio/speed balance
- **Dictionary encoding:** enabled for high-cardinality string columns
- **Row group size:** default 64MB (PyArrow default)

### Query Patterns

- Ad-hoc historical queries (7–90 day range)
- DuckDB on-demand: reads Parquet directly from R2 via S3 API
- Used for AI analysis evidence gathering on older data
- P95 latency target: < 5s for typical analytical queries

```sql
-- DuckDB query example
SELECT count(*), status_code
FROM read_parquet('s3://soonwhy-cold/{org}/{project}/2026-01-15/requests.parquet')
WHERE timestamp BETWEEN '2026-01-15 00:00:00' AND '2026-01-15 23:59:59'
GROUP BY status_code;
```

---

## Tier 3: Archive Storage (R2 + Parquet)

**Retention:** 90–365 days

### R2 Bucket Structure

Same bucket, different prefix:

```
soonwhy-archive/
└── {org_id}/
    └── {project_id}/
        └── {YYYY-MM}/
            ├── logs.parquet
            ├── metrics.parquet
            ├── traces.parquet
            ├── spans.parquet
            ├── requests.parquet
            └── errors.parquet
```

### Monthly Consolidation

Cold files older than 90 days are consolidated into monthly Parquet files:

```
cold:    {org}/{project}/2026-01-15/logs.parquet
archive: {org}/{project}/2026-01/logs.parquet
```

This reduces file count and improves scan performance for long-range queries.

### Compression

Same as cold tier (zstd level 3). No change in encoding settings.

### Query Patterns

- Compliance and audit queries
- Long-term trend analysis
- Rare: monthly/quarterly aggregations
- P95 latency target: < 30s for full-month scans

---

## Migration Strategy

### Hot → Cold (Daily)

**Schedule:** Every 5 minutes via Scheduler service

**Process:**

1. Scheduler queries ClickHouse for partitions where `max(timestamp) < now() - INTERVAL 7 DAY`
2. Groups results by `(org_id, project_id, date)`
3. Publishes migration tasks to NATS: `scheduler.tasks.migrate-cold`
4. Processor Worker:
   - Reads batch from ClickHouse: `SELECT * FROM {table} WHERE date = '{target_date}' AND org_id = '{org_id}' AND project_id = '{project_id}'`
   - Converts to Arrow, then Parquet
   - Uploads to `s3://soonwhy-cold/{org_id}/{project_id}/{YYYY-MM-DD}/{table}.parquet`
   - Verifies upload via HEAD request (content-length match)
   - Deletes source rows from ClickHouse: `ALTER TABLE {table} DELETE WHERE ...`
   - Runs `OPTIMIZE TABLE {table} FINAL`

**Idempotency:** Migration checks R2 for existing file before writing. If file exists and size matches, skip.

**Backpressure:** NATS JetStream queue limits prevent overload. Failed tasks retry up to 3 times with exponential backoff.

### Cold → Archive (Monthly)

**Schedule:** First of each month

**Process:**

1. Lists all cold files where `date < now() - INTERVAL 90 DAY`
2. Reads all daily Parquet files for a given `(org_id, project_id, month)`
3. Concatenates into single monthly Parquet file
4. Uploads to `s3://soonwhy-archive/{org_id}/{project_id}/{YYYY-MM}/{table}.parquet`
5. Deletes source daily files from cold bucket

### Archive → Delete (Monthly)

**Schedule:** First of each month

**Process:**

1. Lists all archive files where `date < now() - INTERVAL 365 DAY`
2. Deletes files
3. Logs deletion event for audit trail

### Migration Metadata

Each Parquet file includes metadata:

```json
{
  "soonwhy:version": "1",
  "soonwhy:org_id": "...",
  "soonwhy:project_id": "...",
  "soonwhy:table": "logs",
  "soonwhy:migrated_at": "2026-01-22T00:00:00Z",
  "soonwhy:source_row_count": 123456,
  "soonwhy:source_size_bytes": 10485760
}
```

---

## Cost Optimization

| Strategy | Impact |
|----------|--------|
| **zstd compression** | ~70% size reduction vs raw JSON |
| **Dictionary encoding** | ~30% reduction on string-heavy columns (org_id, event_type) |
| **Monthly consolidation** | Reduces R2 GET requests by ~30x for archive tier |
| **7-day hot retention** | Keeps ClickHouse storage minimal (~1GB/day per project) |
| **Delete after migrate** | Prevents duplicate storage across tiers |
| **R2 free egress** | No cost for DuckDB reads from cold/archive |
| **Lifecycle policies** | R2 built-in rules for auto-expire at 365 days |

### Estimated Storage per Project (10K events/day)

| Tier | Duration | Volume | Cost Est. |
|------|----------|--------|-----------|
| Hot | 7 days | ~700K events, ~500MB | ClickHouse operational |
| Cold | 83 days | ~8.3M events, ~4GB | R2 storage ~$0.02/mo |
| Archive | 275 days | ~27.5M events, ~12GB | R2 storage ~$0.06/mo |

---

## Monitoring

- **Migration lag:** Alert if cold migration falls behind by > 1 hour
- **File integrity:** Verify row counts match source after upload
- **Storage growth:** Track per-org storage usage for billing
- **Query latency:** Monitor DuckDB cold query P95
