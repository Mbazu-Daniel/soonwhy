# Phase 0: Product Foundation — Task Breakdown

Status: in-progress — engineering foundation done (NestJS + ClickHouse + NATS + Better Auth + TanStack Start, `apps/api`/`apps/ui`/`apps/sdk` structure, `common/` infra, `find*`→`get*`), docs in `docs/` still need completion. Updated 2026-09-05.

## Problem Statement

Soonwhy is a new AI-powered observability platform. Before writing any production code, we need to create the authoritative technical and product specification that all future development references. Without this foundation, AI agents and developers will invent architecture, make inconsistent decisions, and produce an incoherent product.

## Solution

Create a complete set of foundational documents (PRD, architecture specs, coding standards, ADRs) that define what Soonwhy is, how it works, and how it should be built. These documents become the contract that keeps the entire codebase coherent.

## User Stories

1. As a developer joining the project, I want to read SOONWHY.md and understand what the product does, so that I can contribute without asking fundamental questions.
2. As an AI agent, I want to read AGENTS.md and understand the project structure, coding conventions, and development workflow, so that I can implement features correctly.
3. As a product owner, I want a clear PRD that defines MVP scope, personas, and success metrics, so that we can prioritize work and measure progress.
4. As a developer, I want documented architecture decisions (ADRs) with rationale, so that I understand why certain technologies were chosen.
5. As a developer, I want a domain glossary (CONTEXT.md) that defines all Soonwhy terminology, so that we use consistent language across the codebase.
6. As a developer, I want documented API conventions and error-handling patterns, so that I can implement endpoints consistently.
7. As a developer, I want a testing strategy document, so that I know what tests to write and how to write them.
8. As a developer, I want a Git branching strategy, so that I know how to manage branches and commits.
9. As a developer, I want coding standards documented, so that I can write code that matches the project's style.
10. As a developer, I want the monorepo structure defined, so that I know where to place new packages and services.
11. As a developer, I want the deployment architecture documented, so that I understand how services are deployed and connected.
12. As a developer, I want the security architecture documented, so that I implement authentication, authorization, and data isolation correctly.
13. As a developer, I want the SDK architecture documented, so that I understand how the SDK communicates with the backend.
14. As a developer, I want the AI architecture documented, so that I understand how evidence-gated responses work.
15. As a developer, I want the telemetry schema defined, so that I know the exact structure of logs, metrics, traces, and spans.
16. As a developer, I want the storage architecture documented (ClickHouse for hot, R2+Parquet for cold), so that I understand the data flow.
17. As a developer, I want the multi-tenancy model documented (shared DB with RLS), so that I implement tenant isolation correctly.
18. As a developer, I want the pricing model documented, so that I understand usage metering requirements.
19. As a developer, I want a dependency graph of all epics, so that I understand what can be parallelized.
20. As a developer, I want a Definition of Done for every task, so that I know when work is complete.
21. As a developer, I want the error-handling conventions documented, so that I handle errors consistently across the stack.
22. As a developer, I want the observability strategy documented, so that I instrument Soonwhy itself correctly.
23. As a developer, I want the release strategy documented, so that I understand versioning and deployment cadence.
24. As a developer, I want the AI task format documented, so that I can break work into agent-executable chunks.
25. As a developer, I want the product principles documented, so that I make design decisions aligned with the product vision.
26. As a developer, I want the personas and user journeys documented, so that I understand who we're building for.
27. As a developer, I want the competitive research documented, so that I understand how Soonwhy differs from Datadog, SigNoz, and Grafana.
28. As a developer, I want the MVP definition documented, so that I know exactly what's in and out of scope.
29. As a developer, I want the roadmap documented, so that I understand the sequence of epics.
30. As a developer, I want the success metrics documented, so that I know what we're optimizing for.

## Implementation Decisions

### Documents to Create

1. **SOONWHY.md** — Master product document (vision, principles, personas, JTBD, pricing, MVP, roadmap)
2. **PRD.md** — Product Requirements Document (features, user stories, acceptance criteria)
3. **CONTEXT.md** — Domain glossary (already exists, needs review)
4. **AGENTS.md** — Agent development guidelines (already exists, needs expansion)
5. **docs/architecture/system.md** — System architecture (services, data flow, deployment)
6. **docs/architecture/storage.md** — Storage architecture (ClickHouse + R2 + Parquet)
7. **docs/architecture/ai.md** — AI architecture (evidence gating, confidence scoring)
8. **docs/architecture/security.md** — Security architecture (auth, tenancy, isolation)
9. **docs/architecture/sdk.md** — SDK architecture (Node SDK, ingestion, batching)
10. **docs/architecture/api.md** — API conventions (REST, versioning, error format)
11. **docs/engineering/coding-standards.md** — TypeScript/React/NestJS coding standards
12. **docs/engineering/testing-strategy.md** — Unit, integration, E2E testing approach
13. **docs/engineering/git-strategy.md** — Branching, commits, PRs
14. **docs/engineering/error-handling.md** — Error types, propagation, user-facing errors
15. **docs/engineering/observability.md** — How Soonwhy monitors itself
16. **docs/engineering/definition-of-done.md** — Task completion criteria
17. **docs/adr/0001-*.md through 0005-*.md** — Already created, review for completeness
18. **docs/adr/0006-telemetry-schema.md** — Canonical telemetry event format
19. **docs/adr/0007-storage-lifecycle.md** — Hot/cold/archive data lifecycle
20. **docs/adr/0008-api-versioning.md** — API versioning strategy

### Key Architecture Decisions (Already Made)

- **Backend**: NestJS + Drizzle ORM (ADR-0001)
- **Hot Storage**: Self-hosted ClickHouse on Dokploy (ADR-0002)
- **Cold Storage**: Cloudflare R2 + Parquet (ADR-0002)
- **Event Bus**: NATS JetStream
- **Pricing**: Pure pay-as-you-go (ADR-0003)
- **AI**: Evidence-gated responses with confidence thresholds (ADR-0004)
- **Tenancy**: Shared PostgreSQL with Row-Level Security (ADR-0005)
- **Auth**: Better Auth
- **Frontend**: TanStack Start + React + Tailwind + shadcn/ui
- **Monorepo**: pnpm workspaces

### Telemetry Schema (Preliminary)

```
TelemetryEvent {
  id: UUID
  org_id: UUID
  project_id: UUID
  environment_id: UUID
  service_id: UUID
  timestamp: DateTime
  type: EventType (log | metric | trace | span | request | error)
  trace_id?: String
  span_id?: String
  attributes: Map<String, Any>
  resource: Map<String, Any>
}
```

### File Structure (Actual 2026-09-05 — `packages/` cleaned, `apps/` is source)

```
soonwhy/
├── apps/
│   ├── api/                    # NestJS API (src/common/{clickhouse,nats,redis,db,data-archival}, src/modules/v1/{auth,organizations,projects,services,api-keys,ingestion,dashboard,health}, src/shared)
│   ├── ui/                     # TanStack Start (src/components/ui, src/lib, src/routes, src/shared) — moved from packages/frontend
│   └── sdk/                    # @soonwhy/sdk (src/client.ts, src/auto/{http,db}) — moved from packages/sdk
├── tsconfig/                   # base.json, nestjs.json — moved from packages/tsconfig
├── shared/ (now in apps)       # apps/api/src/shared + apps/ui/src/shared — moved from packages/shared
├── docs/
│   ├── adr/                    # Architecture Decision Records
│   ├── agents/                 # Agent skill configs
│   ├── architecture/           # Architecture documentation
│   └── engineering/            # Engineering standards
└── .scratch/                   # Issue tracker (phase-0, phase-2, phase-3)
└── packages/                   # cleaned — only .gitkeep (was packages/frontend, shared, sdk, tsconfig, backend)
```

## Testing Decisions

- **Unit tests**: Vitest for all TypeScript code
- **Integration tests**: Test API endpoints against real PostgreSQL + ClickHouse
- **E2E tests**: Playwright for critical user flows
- **Test location**: Co-located with source code (`*.test.ts` files)
- **Coverage target**: 80% for business logic, 60% overall
- **Mocking strategy**: Mock external services (Stripe, AI providers), use real databases

## Out of Scope

- Writing actual production code (that's Phase 1+)
- Setting up CI/CD pipelines (Phase 1)
- Deploying to production (Phase 1)
- Building the SDK (Phase 2)
- Building Mission Control dashboard (Phase 3)
- AI intelligence features (Phase 6)

## Further Notes

This spec should be completed before any Phase 1 work begins. The exit condition is: an AI agent can read SOONWHY.md, AGENTS.md, and the architecture docs, and implement a feature without asking fundamental architectural questions.
