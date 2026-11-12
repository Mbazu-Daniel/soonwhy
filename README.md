# Soonwhy

OpenTelemetry-native observability with detection, evidence-gated AI analysis, and a service-map UI.

## Stack

- `apps/api` — NestJS ingestion/query API (PostgreSQL + Drizzle)
- `apps/ui` — TanStack Start dashboard
- `packages/ingest` — OTLP ingestion worker (NATS → Quickwit/Object storage)
- `sdk/node` — @soonwhy/node, Node SDK (OTLP traces)
- `sdk/nest` — @soonwhy/nest, NestJS integration
- `sdk/next` — @soonwhy/next, Next.js App Router integration
- `sdk/vite` — @soonwhy/vite, Vite dev-server integration
- `packages/shared` — shared contracts and PII field encryption

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
