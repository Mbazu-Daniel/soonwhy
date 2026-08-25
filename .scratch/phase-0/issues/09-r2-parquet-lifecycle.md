# 09: R2 + Parquet Lifecycle

**What to build:** A document defining cold storage structure and data migration strategy.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] R2 bucket structure (org/project/environment/date/type)
- [x] Parquet file naming convention
- [x] Partition strategy for Parquet (org, project, date, event_type)
- [x] Migration strategy (ClickHouse → R2, scheduled batch)
- [x] Retention policy (7-30 days warm, 30-90 days archive, 90+ delete)
- [x] Query strategy for cold data (DuckDB on-demand)
- [x] Compression settings

**Output:** `docs/architecture/storage-lifecycle.md`
