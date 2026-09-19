# Local development with Docker

The local stack runs the application and its infrastructure together:

- UI: http://localhost:3000
- API: http://localhost:3001
- OTLP ingestion: http://localhost:3002
- Quickwit: http://localhost:7280
- MinIO API: http://localhost:9000
- MinIO console: http://localhost:9001
- NATS: nats://localhost:4222
- PostgreSQL: localhost:5432
- Redis: localhost:6379

Start everything with `docker compose up --build`.

For a detached stack use `docker compose up --build -d`.

Stop the stack with `docker compose down`. Add `-v` to remove local data.

Quickwit uses MinIO as the local S3-compatible object store, matching the object-storage-first telemetry architecture.

For hot reload, keep the infrastructure containers running and use the existing `pnpm dev` workflow on the host.
