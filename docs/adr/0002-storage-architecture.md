# ADR-0002: Quickwit indexes on object storage

## Status

Accepted

## Decision

Soonwhy uses Quickwit as the primary telemetry indexing and search layer. Quickwit index splits and metastore are stored on S3-compatible object storage such as Cloudflare R2.

The telemetry path is:

OpenTelemetry -> OTLP ingestion -> NATS JetStream -> Quickwit -> object storage -> search and analysis.

Postgres remains the source of truth for SaaS resources. ClickHouse is not part of the telemetry storage path.

## Why

- Object storage was a core requirement from the beginning.
- Quickwit separates durable storage from stateless indexing and search workloads.
- Logs and traces are first-class search workloads.
- NATS keeps ingestion durable and decoupled from indexing.
- The same storage model can be used for local MinIO development and R2 production.

## Consequences

Quickwit index configuration and object-storage credentials must be provisioned for each environment. Telemetry APIs must apply organization and project filters to every query. Analytical features that need joins or complex computation should operate on Quickwit query results or on derived analysis datasets rather than reintroducing a second primary telemetry database.
