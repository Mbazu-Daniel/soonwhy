# Soonwhy — ClickHouse Schema

## Overview

ClickHouse serves as the hot storage layer (0–7 days) for all telemetry data. After 7 days, data is archived to R2 + Parquet (cold storage). All tables use the `MergeTree` engine family and are partitioned by day for efficient TTL management and query pruning.

---

## Common Settings

```sql
SET max_insert_block_size = 1048576;
SET min_insert_block_size_rows = 100000;
SET min_insert_block_size_bytes = 104857600;
```

---

## 1. TelemetryEvent Table

The unified ingestion table. Raw events land here first; materialized views fan out to signal-specific tables.

```sql
CREATE TABLE telemetry_events
(
    event_id        UUID DEFAULT generateUUIDv4(),
    org_id          LowCardinality(String),
    project_id      LowCardinality(String),
    environment_id  LowCardinality(String),
    service_name    LowCardinality(String),

    event_type      Enum8('log' = 1, 'metric' = 2, 'trace' = 3, 'span' = 4, 'request' = 5, 'error' = 6),

    timestamp       DateTime64(3, 'UTC'),
    received_at     DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),

    payload         String,           -- raw JSON payload
    attributes      Map(String, String),
    resource        Map(String, String),

    _partition_date Date DEFAULT toDate(timestamp)
)
ENGINE = MergeTree()
PARTITION BY _partition_date
ORDER BY (org_id, project_id, timestamp, event_id)
TTL timestamp + INTERVAL 7 DAY DELETE
SETTINGS index_granularity = 8192;
```

---

## 2. Logs Table

```sql
CREATE TABLE logs
(
    event_id        UUID,
    org_id          LowCardinality(String),
    project_id      LowCardinality(String),
    environment_id  LowCardinality(String),
    service_name    LowCardinality(String),

    timestamp       DateTime64(3, 'UTC'),

    level           Enum8('trace' = 0, 'debug' = 1, 'info' = 2, 'warn' = 3, 'error' = 4, 'fatal' = 5),
    message         String,
    logger          LowCardinality(Nullable(String)),
    attributes      Map(String, String),
    stack_trace     Nullable(String),

    _partition_date Date DEFAULT toDate(timestamp)
)
ENGINE = MergeTree()
PARTITION BY _partition_date
ORDER BY (org_id, project_id, service_name, timestamp, event_id)
TTL timestamp + INTERVAL 7 DAY DELETE
SETTINGS index_granularity = 8192;

-- Index for fast level filtering
ALTER TABLE logs ADD INDEX idx_level (level) TYPE minmax GRANULARITY 4;
-- Index for message substring search
ALTER TABLE logs ADD INDEX idx_message (message) TYPE tokenbf_v1(10240, 3, 0) GRANULARITY 1;
```

---

## 3. Metrics Table

```sql
CREATE TABLE metrics
(
    event_id        UUID,
    org_id          LowCardinality(String),
    project_id      LowCardinality(String),
    environment_id  LowCardinality(String),
    service_name    LowCardinality(String),

    timestamp       DateTime64(3, 'UTC'),

    metric_name     LowCardinality(String),
    metric_type     Enum8('counter' = 1, 'gauge' = 2, 'histogram' = 3, 'summary' = 4),
    value           Float64,
    unit            LowCardinality(Nullable(String)),
    labels          Map(String, String),

    _partition_date Date DEFAULT toDate(timestamp)
)
ENGINE = MergeTree()
PARTITION BY _partition_date
ORDER BY (org_id, project_id, service_name, metric_name, timestamp, event_id)
TTL timestamp + INTERVAL 7 DAY DELETE
SETTINGS index_granularity = 8192;

ALTER TABLE metrics ADD INDEX idx_metric_name (metric_name) TYPE bloom_filter(0.01) GRANULARITY 4;
ALTER TABLE metrics ADD INDEX idx_metric_type (metric_type) TYPE minmax GRANULARITY 4;
```

### Histogram Buckets Table

Pre-aggregated histogram buckets for fast percentile queries.

```sql
CREATE TABLE histogram_buckets
(
    org_id          LowCardinality(String),
    project_id      LowCardinality(String),
    service_name    LowCardinality(String),
    metric_name     LowCardinality(String),
    timestamp       DateTime64(3, 'UTC'),

    le              Float64,   -- bucket upper bound (Inf for +Inf)
    count           UInt64,
    labels          Map(String, String),

    _partition_date Date DEFAULT toDate(timestamp)
)
ENGINE = SummingMergeTree()
PARTITION BY _partition_date
ORDER BY (org_id, project_id, service_name, metric_name, timestamp, le, labels)
TTL timestamp + INTERVAL 7 DAY DELETE
SETTINGS index_granularity = 8192;
```

---

## 4. Traces Table

```sql
CREATE TABLE traces
(
    trace_id        String,
    org_id          LowCardinality(String),
    project_id      LowCardinality(String),
    environment_id  LowCardinality(String),
    service_name    LowCardinality(String),

    root_span_name  String,
    start_time      DateTime64(3, 'UTC'),
    end_time        DateTime64(3, 'UTC'),
    duration_ms     Float64,

    span_count      UInt32,
    error_count     UInt32 DEFAULT 0,
    status          Enum8('ok' = 1, 'error' = 2, 'unset' = 3),

    resource        Map(String, String),
    attributes      Map(String, String),

    _partition_date Date DEFAULT toDate(start_time)
)
ENGINE = MergeTree()
PARTITION BY _partition_date
ORDER BY (org_id, project_id, service_name, start_time, trace_id)
TTL start_time + INTERVAL 7 DAY DELETE
SETTINGS index_granularity = 8192;

ALTER TABLE traces ADD INDEX idx_status (status) TYPE minmax GRANULARITY 4;
ALTER TABLE traces ADD INDEX idx_duration (duration_ms) TYPE minmax GRANULARITY 4;
```

---

## 5. Spans Table

```sql
CREATE TABLE spans
(
    span_id         String,
    trace_id        String,
    parent_span_id  Nullable(String),
    org_id          LowCardinality(String),
    project_id      LowCardinality(String),
    environment_id  LowCardinality(String),
    service_name    LowCardinality(String),

    span_name       String,
    span_kind       Enum8('internal' = 0, 'server' = 1, 'client' = 2, 'producer' = 3, 'consumer' = 4),
    start_time      DateTime64(3, 'UTC'),
    end_time        DateTime64(3, 'UTC'),
    duration_ms     Float64,

    status_code     UInt16,
    status_message  Nullable(String),

    attributes      Map(String, String),
    events          Array(Tuple(timestamp DateTime64(3, 'UTC'), name String, attributes Map(String, String))),

    _partition_date Date DEFAULT toDate(start_time)
)
ENGINE = MergeTree()
PARTITION BY _partition_date
ORDER BY (org_id, project_id, service_name, trace_id, start_time, span_id)
TTL start_time + INTERVAL 7 DAY DELETE
SETTINGS index_granularity = 8192;

ALTER TABLE spans ADD INDEX idx_span_name (span_name) TYPE bloom_filter(0.01) GRANULARITY 4;
ALTER TABLE spans ADD INDEX idx_status_code (status_code) TYPE minmax GRANULARITY 4;
ALTER TABLE spans ADD INDEX idx_duration (duration_ms) TYPE minmax GRANULARITY 4;
```

---

## 6. Requests Table

```sql
CREATE TABLE requests
(
    request_id      UUID,
    org_id          LowCardinality(String),
    project_id      LowCardinality(String),
    environment_id  LowCardinality(String),
    service_name    LowCardinality(String),

    timestamp       DateTime64(3, 'UTC'),

    method          LowCardinality(String),   -- GET, POST, PUT, DELETE, etc.
    url             String,
    route           LowCardinality(Nullable(String)),
    status_code     UInt16,
    duration_ms     Float64,

    request_size    Nullable(UInt64),
    response_size   Nullable(UInt64),

    user_agent      Nullable(String),
    ip_address      Nullable(IPv4),

    trace_id        Nullable(String),
    attributes      Map(String, String),

    _partition_date Date DEFAULT toDate(timestamp)
)
ENGINE = MergeTree()
PARTITION BY _partition_date
ORDER BY (org_id, project_id, service_name, timestamp, request_id)
TTL timestamp + INTERVAL 7 DAY DELETE
SETTINGS index_granularity = 8192;

ALTER TABLE requests ADD INDEX idx_status_code (status_code) TYPE minmax GRANULARITY 4;
ALTER TABLE requests ADD INDEX idx_method (method) TYPE set(10) GRANULARITY 4;
ALTER TABLE requests ADD INDEX idx_route (route) TYPE bloom_filter(0.01) GRANULARITY 4;
ALTER TABLE requests ADD INDEX idx_duration (duration_ms) TYPE minmax GRANULARITY 4;
```

---

## 7. Errors Table

```sql
CREATE TABLE errors
(
    error_id        UUID,
    org_id          LowCardinality(String),
    project_id      LowCardinality(String),
    environment_id  LowCardinality(String),
    service_name    LowCardinality(String),

    timestamp       DateTime64(3, 'UTC'),

    error_type      LowCardinality(String),
    message         String,
    stack_trace     Nullable(String),

    count           UInt32 DEFAULT 1,          -- for deduplicated/aggregated errors
    first_seen      DateTime64(3, 'UTC'),
    last_seen       DateTime64(3, 'UTC'),

    trace_id        Nullable(String),
    http_status     Nullable(UInt16),
    attributes      Map(String, String),

    _partition_date Date DEFAULT toDate(timestamp)
)
ENGINE = MergeTree()
PARTITION BY _partition_date
ORDER BY (org_id, project_id, service_name, error_type, timestamp, error_id)
TTL timestamp + INTERVAL 7 DAY DELETE
SETTINGS index_granularity = 8192;

ALTER TABLE errors ADD INDEX idx_error_type (error_type) TYPE bloom_filter(0.01) GRANULARITY 4;
ALTER TABLE errors ADD INDEX idx_http_status (http_status) TYPE minmax GRANULARITY 4;
```

---

## 8. Materialized Views

### Log Level Counts (per minute)

```sql
CREATE MATERIALIZED VIEW mv_log_level_counts
ENGINE = SummingMergeTree()
PARTITION BY _partition_date
ORDER BY (org_id, project_id, service_name, timestamp, level)
AS
SELECT
    org_id,
    project_id,
    service_name,
    toStartOfMinute(timestamp) AS timestamp,
    level,
    1 AS count,
    toDate(timestamp) AS _partition_date
FROM logs;
```

### Request Latency Buckets (per minute)

```sql
CREATE MATERIALIZED VIEW mv_request_latency_buckets
ENGINE = SummingMergeTree()
PARTITION BY _partition_date
ORDER BY (org_id, project_id, service_name, timestamp, bucket)
AS
SELECT
    org_id,
    project_id,
    service_name,
    toStartOfMinute(timestamp) AS timestamp,
    toFloat64(
        multiIf(
            duration_ms < 10, 10,
            duration_ms < 50, 50,
            duration_ms < 100, 100,
            duration_ms < 250, 250,
            duration_ms < 500, 500,
            duration_ms < 1000, 1000,
            duration_ms < 5000, 5000,
            50000
        )
    ) AS bucket,
    1 AS count,
    toDate(timestamp) AS _partition_date
FROM requests;
```

### Request Status Counts (per minute)

```sql
CREATE MATERIALIZED VIEW mv_request_status_counts
ENGINE = SummingMergeTree()
PARTITION BY _partition_date
ORDER BY (org_id, project_id, service_name, timestamp, status_group)
AS
SELECT
    org_id,
    project_id,
    service_name,
    toStartOfMinute(timestamp) AS timestamp,
    concat(toString(divide(status_code, 100)), 'xx') AS status_group,
    1 AS count,
    toDate(timestamp) AS _partition_date
FROM requests;
```

### Error Counts by Type (per minute)

```sql
CREATE MATERIALIZED VIEW mv_error_counts
ENGINE = SummingMergeTree()
PARTITION BY _partition_date
ORDER BY (org_id, project_id, service_name, timestamp, error_type)
AS
SELECT
    org_id,
    project_id,
    service_name,
    toStartOfMinute(timestamp) AS timestamp,
    error_type,
    count AS error_count,
    toDate(timestamp) AS _partition_date
FROM errors;
```

### Metric Aggregation (per 5 minutes)

```sql
CREATE MATERIALIZED VIEW mv_metric_aggregates
ENGINE = AggregatingMergeTree()
PARTITION BY _partition_date
ORDER BY (org_id, project_id, service_name, metric_name, timestamp)
AS
SELECT
    org_id,
    project_id,
    service_name,
    metric_name,
    toStartOfFiveMinutes(timestamp) AS timestamp,
    minState(value) AS min_value,
    maxState(value) AS max_value,
    avgState(value) AS avg_value,
    countState() AS sample_count,
    toDate(timestamp) AS _partition_date
FROM metrics
WHERE metric_type = 'gauge'
GROUP BY org_id, project_id, service_name, metric_name, timestamp;
```

---

## 9. Partitioning Strategy

All tables partition by **day** using `_partition_date`:

```sql
PARTITION BY _partition_date  -- toDate(timestamp)
```

- **Benefits:** TTL deletes drop entire partitions (instant, no merges), queries filter by date range skip irrelevant partitions, cold migration exports whole partitions to Parquet.
- **Partition lifecycle:** ClickHouse automatically drops partitions where all parts have exceeded the TTL.
- **Filesystem layout:** `s3://soonwhy-cold/{org_id}/{project_id}/{date}/{table}.parquet`

---

## 10. Indexes & Sorting Keys Summary

| Table | ORDER BY | Secondary Indexes |
|-------|----------|-------------------|
| `telemetry_events` | `org_id, project_id, timestamp, event_id` | — |
| `logs` | `org_id, project_id, service_name, timestamp, event_id` | `level` (minmax), `message` (tokenbf) |
| `metrics` | `org_id, project_id, service_name, metric_name, timestamp, event_id` | `metric_name` (bloom), `metric_type` (minmax) |
| `traces` | `org_id, project_id, service_name, start_time, trace_id` | `status` (minmax), `duration_ms` (minmax) |
| `spans` | `org_id, project_id, service_name, trace_id, start_time, span_id` | `span_name` (bloom), `status_code` (minmax), `duration_ms` (minmax) |
| `requests` | `org_id, project_id, service_name, timestamp, request_id` | `status_code` (minmax), `method` (set), `route` (bloom), `duration_ms` (minmax) |
| `errors` | `org_id, project_id, service_name, error_type, timestamp, error_id` | `error_type` (bloom), `http_status` (minmax) |

**Key design decisions:**
- `org_id, project_id` always lead the sort key — ClickHouse scans only the relevant tenant's data.
- `service_name` is included early for per-service filtering.
- `event_id` / `trace_id` appear at the end for point lookups.
- Timestamps are `DateTime64(3, 'UTC')` for millisecond precision.

---

## 11. TTL & Data Lifecycle

```sql
-- All tables: 7-day hot retention
TTL timestamp + INTERVAL 7 DAY DELETE
```

**Lifecycle flow:**

1. **Ingestion (0–100ms):** SDK → API → NATS → Processor Worker → ClickHouse `telemetry_events`.
2. **Fan-out:** Materialized views populate signal-specific tables (`logs`, `metrics`, `traces`, `spans`, `requests`, `errors`).
3. **Hot queries (0–7 days):** Dashboard and AI worker query ClickHouse directly. Sub-200ms P95 latency.
4. **Cold migration (every 5 minutes):** Scheduler reads partitions older than 7 days, exports to Parquet on R2, then deletes the partition from ClickHouse.
5. **Cold queries (7–90 days):** Parquet files on R2 queried via external table or Trino.
6. **Archive (90–365 days):** Parquet files moved to archive tier on R2.

**Archive path:** `s3://soonwhy-cold/{org_id}/{project_id}/{date}/{table}.parquet`

---

## 12. Example Queries

### P50/P95/P99 Latency for a Service

```sql
SELECT
    quantile(0.50)(duration_ms) AS p50,
    quantile(0.95)(duration_ms) AS p95,
    quantile(0.99)(duration_ms) AS p99
FROM requests
WHERE org_id = 'org_abc'
  AND project_id = 'proj_123'
  AND service_name = 'api'
  AND timestamp >= now() - INTERVAL 1 HOUR;
```

### Error Rate Over Time

```sql
SELECT
    toStartOfMinute(timestamp) AS t,
    countIf(status_code >= 500) AS errors,
    count() AS total,
    round(errors / total, 4) AS error_rate
FROM requests
WHERE org_id = 'org_abc'
  AND project_id = 'proj_123'
  AND timestamp >= now() - INTERVAL 24 HOUR
GROUP BY t
ORDER BY t;
```

### Top Spans by Duration

```sql
SELECT
    span_name,
    service_name,
    duration_ms,
    trace_id
FROM spans
WHERE org_id = 'org_abc'
  AND project_id = 'proj_123'
  AND start_time >= now() - INTERVAL 1 HOUR
ORDER BY duration_ms DESC
LIMIT 20;
```

### Gauge Metric Time Series

```sql
SELECT
    toStartOfMinute(timestamp) AS t,
    avg(value) AS avg_value
FROM metrics
WHERE org_id = 'org_abc'
  AND project_id = 'proj_123'
  AND metric_name = 'cpu_usage_percent'
  AND metric_type = 'gauge'
  AND timestamp >= now() - INTERVAL 1 HOUR
GROUP BY t
ORDER BY t;
```
