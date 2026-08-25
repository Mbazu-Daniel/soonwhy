# ADR-0002: ClickHouse (Self-Hosted on Dokploy) for Hot Data, R2 + Parquet for Cold

## Status

Accepted

## Context

Soonwhy needs to store telemetry data for querying. The AI needs fast access to recent data for root-cause analysis, while historical data needs cost-efficient storage.

## Decision

- **Hot data (0-7 days)**: Self-hosted ClickHouse on Dokploy for fast analytical queries
- **Cold data (7+ days)**: Cloudflare R2 + Parquet for cost-efficient archival

## Consequences

### Positive
- ClickHouse is purpose-built for time-series analytics (10-100x faster than PostgreSQL for aggregations)
- Self-hosted on Dokploy = full control, no vendor lock-in
- Single VPS deployment with Docker Compose (low operational complexity)
- Full SQL flexibility (JOINs, window functions, CTEs — no pipe model limits)
- Cost-efficient: ~$20-50/mo VPS handles 50GB/day ingestion
- Parquet provides columnar analytics for historical analysis

### Negative
- Two storage systems to maintain
- Need to implement data migration from ClickHouse to R2
- Parquet is not queryable in real-time
- Self-hosted requires backup strategy

### Mitigation
- Workers handle migration from ClickHouse to R2 on schedule
- Query abstraction layer hides storage complexity from application
- For historical analysis, load Parquet into DuckDB on-demand
- ClickHouse has built-in BACKUP/RESTORE commands

## Alternatives Considered
- **TimescaleDB**: PostgreSQL extension, but 10-100x slower for analytical queries at scale
- **Tinybird**: Managed ClickHouse, but vendor lock-in and higher costs at scale
- **ClickHouse Cloud**: Managed, but adds cost without significant benefit for MVP
- **R2 only**: Too slow for ad-hoc queries
- **PostgreSQL only**: Expensive at scale for archival data

## Deployment

Self-hosted on Dokploy via Docker Compose:
- Official ClickHouse Docker image
- Named volume for data persistence
- Monitoring via ClickHouse system tables
