# Soonwhy

**AI-powered observability platform with evidence-gated root cause analysis.**

## What Soonwhy Is

Soonwhy is a multi-tenant SaaS observability platform that ingests logs, metrics, traces, and API monitoring data, then uses AI to perform root cause analysis — every conclusion backed by concrete evidence. Unlike traditional observability tools that surface dashboards and alerts, Soonwhy answers "why is this broken?" with cited telemetry data points and a confidence score.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Frontend   │────▶│    API Service    │────▶│  PostgreSQL  │
│ (TanStack)   │     │    (NestJS)       │     │  (metadata)  │
└─────────────┘     └──────────────────┘     └──────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
            ┌──────────────┐ ┌──────────────┐
            │  Ingestion   │ │  AI Worker   │
            │   Worker     │ │  (analysis)  │
            └──────┬───────┘ └──────┬───────┘
                   │                │
              ┌────▼────┐    ┌──────▼──────┐
              │ NATS    │    │  LLM APIs   │
              │ JetStream│   │ (OpenAI/etc)│
              └────┬────┘    └─────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────┐     ┌──────────────┐
│  ClickHouse  │     │  R2 + Parquet │
│ (hot: 0-7d) │     │ (cold: 7d+)  │
└──────────────┘     └──────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | TanStack Start, React, Tailwind CSS, shadcn/ui |
| Backend | NestJS, Drizzle ORM, Zod |
| Database | PostgreSQL (metadata), ClickHouse (telemetry) |
| Cold Storage | Cloudflare R2 + Parquet |
| Event Bus | NATS JetStream |
| Auth | Better Auth (self-hosted) |
| Monorepo | pnpm workspaces |
| Linter | oxlint |
| Formatter | oxfmt |
| Test Runner | vitest |

## How to Run

```bash
pnpm dev        # start frontend + backend
pnpm build      # build all packages
pnpm test       # run vitest
pnpm lint       # run oxlint
pnpm format     # run oxfmt
```

## Key Decisions

- [ADR-0001: NestJS Backend](docs/adr/0001-nestjs-backend.md) — TypeScript team familiarity
- [ADR-0002: ClickHouse Storage](docs/adr/0002-clickhouse-storage.md) — self-hosted on Dokploy
- [ADR-0003: Pricing Model](docs/adr/0003-pricing-model.md) — pure pay-as-you-go
- [ADR-0004: AI Evidence Gating](docs/adr/0004-ai-evidence-gating.md) — confidence threshold 0.7
- [ADR-0005: Multi-tenancy](docs/adr/0005-multi-tenancy.md) — shared PostgreSQL with RLS

## Project Structure

```
packages/
├── frontend/   # TanStack Start + React + Tailwind + shadcn/ui
└── backend/    # NestJS API
```

## Contributing

See [AGENTS.md](AGENTS.md) for engineering conventions, development workflows, and agent guidelines.
