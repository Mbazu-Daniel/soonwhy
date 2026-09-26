# Soonwhy

OpenTelemetry-native observability with detection, evidence-gated AI analysis, and a service-map UI.

## Stack

- `apps/api` — NestJS ingestion/query API (PostgreSQL + Drizzle)
- `apps/ui` — TanStack Start dashboard
- `packages/ingest` — OTLP ingestion worker (NATS → Quickwit/Object storage)
- `packages/sdk` — Node SDK (OTLP traces)
- `packages/shared`, `packages/cron` — shared contracts and scheduled jobs

## Quick start

```bash
pnpm install
make local        # lightweight: Postgres + Redis + API + UI
make local-logs   # follow logs
make local-down   # stop
```

Full telemetry pipeline:

```bash
make observability-build
make observability-logs
make observability-down
```

## Docs (local only)

Design notes, ADRs, and agent skills live on the filesystem only and are intentionally not published to GitHub. Only this `README.md` is tracked.
