# 09: R2 + Parquet Lifecycle

**What to build:** A document defining cold storage structure and data migration strategy.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] R2 bucket structure (org/project/environment/date/type)
- [ ] Parquet file naming convention
- [ ] Partition strategy for Parquet (org, project, date, event_type)
- [ ] Migration strategy (ClickHouse → R2, scheduled batch)
- [ ] Retention policy (7-30 days warm, 30-90 days archive, 90+ delete)
- [ ] Query strategy for cold data (DuckDB on-demand)
- [ ] Compression settings

**Output:** `docs/architecture/cold-storage.md`
