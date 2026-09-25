export const migrations = [
  {
    name: '001_create_logs_table',
    query: `CREATE TABLE IF NOT EXISTS logs (
      id String, timestamp DateTime64(3), org_id String, project_id String,
      service String DEFAULT '', level Enum8('debug'=0,'info'=1,'warn'=2,'error'=3,'fatal'=4) DEFAULT 'info',
      message String DEFAULT '', attributes String DEFAULT '{}', stackTrace String DEFAULT ''
    ) ENGINE = MergeTree() PARTITION BY toYYYYMM(timestamp) ORDER BY (project_id, service, timestamp)
    TTL timestamp + INTERVAL 7 DAY DELETE`,
  },
  {
    name: '002_create_metrics_table',
    query: `CREATE TABLE IF NOT EXISTS metrics (
      id String, timestamp DateTime64(3), org_id String, project_id String,
      service String DEFAULT '', name String DEFAULT '', value Float64 DEFAULT 0,
      unit Enum8('ms'=0,'count'=1,'bytes'=2,'percent'=3) DEFAULT 'count'
    ) ENGINE = MergeTree() PARTITION BY toYYYYMM(timestamp) ORDER BY (project_id, service, name, timestamp)
    TTL timestamp + INTERVAL 7 DAY DELETE`,
  },
  {
    name: '003_create_errors_table',
    query: `CREATE TABLE IF NOT EXISTS errors (
      id String, timestamp DateTime64(3), org_id String, project_id String,
      service String DEFAULT '', errorType String DEFAULT '', errorMessage String DEFAULT '',
      stack String DEFAULT '', fingerprint String DEFAULT ''
    ) ENGINE = MergeTree() PARTITION BY toYYYYMM(timestamp) ORDER BY (project_id, service, fingerprint, timestamp)
    TTL timestamp + INTERVAL 7 DAY DELETE`,
  },
  {
    name: '004_create_requests_table',
    query: `CREATE TABLE IF NOT EXISTS requests (
      id String, timestamp DateTime64(3), org_id String, project_id String,
      service String DEFAULT '', method String DEFAULT '', url String DEFAULT '',
      statusCode UInt16 DEFAULT 0, duration Float64 DEFAULT 0,
      userAgent String DEFAULT '', ip String DEFAULT ''
    ) ENGINE = MergeTree() PARTITION BY toYYYYMM(timestamp) ORDER BY (project_id, service, timestamp)
    TTL timestamp + INTERVAL 7 DAY DELETE`,
  },
  {
    name: '005_create_traces_table',
    query: `CREATE TABLE IF NOT EXISTS traces (
      id String, timestamp DateTime64(3), org_id String, project_id String,
      service String DEFAULT '', traceId String DEFAULT '', spanId String DEFAULT '',
      parentSpanId String DEFAULT '', name String DEFAULT '', duration Float64 DEFAULT 0
    ) ENGINE = MergeTree() PARTITION BY toYYYYMM(timestamp) ORDER BY (project_id, service, traceId, timestamp)
    TTL timestamp + INTERVAL 7 DAY DELETE`,
  },
];
