# Phase 0: Product Foundation — Map

Status: in-progress — engineering foundation done, docs pending (updated 2026-09-05). Phase-2 (SDK & Ingestion) and Phase-3 (Dashboard) are **done**; see their maps.

## Objective

Create the authoritative technical and product specification that all future development references.

## Dependencies

None. This phase blocks everything else.

## Tickets

### Tier 1 (start immediately)

| # | Title | Status | Blocked By |
|---|-------|--------|------------|
| 01 | Product Vision & Personas | open | — |
| 03 | Competitive Positioning | open | — |
| 04 | Pricing Model | open | — |
| 05 | Service Boundaries | done | — |
| 08 | ClickHouse Schema | done | — |
| 09 | R2 + Parquet Lifecycle | done | — |
| 10 | SDK Client Design | done | — |
| 11 | Ingestion API | done | — |
| 12 | Evidence Gating Model | open | — |
| 14 | Authentication Design | done | — |
| 17 | API Conventions | done | — |
| 18 | TypeScript Conventions | done | — |
| 21 | Testing Strategy | open | — |
| 22 | Git Strategy | done | — |
| 23 | Error Handling | done | — |
| 24 | Observability Strategy | open | — |
| 25 | Definition of Done | open | — |

### Tier 2 (after Tier 1)

| # | Title | Status | Blocked By |
|---|-------|--------|------------|
| 02 | MVP Scope & Success Metrics | open | 01 |
| 06 | Data Flow Diagram | open | 05 |
| 07 | Deployment Architecture | open | 05 |
| 13 | AI Provider Abstraction | open | 12 |
| 15 | Authorization & RBAC | done | 14 |
| 16 | Tenant Isolation | done | 15 |
| 19 | React Conventions | done | 18 |
| 20 | NestJS Conventions | done | 18 |

### Tier 3 (after Tier 2)

| # | Title | Status | Blocked By |
|---|-------|--------|------------|
| 26 | SOONWHY.md | open | 01, 02, 03, 04 |
| 27 | AGENTS.md Expansion | open | 18, 19, 20, 21, 22 |
| 28 | Epic Dependency Graph | open | 05, 06 |

## Exit Criteria

An AI agent can read SOONWHY.md, AGENTS.md, and the architecture docs, and implement a feature without asking fundamental architectural questions.

## Frontier

Tickets whose blockers are all done: **01, 03, 04, 05, 08, 09, 10, 11, 12, 14, 17, 18, 21, 22, 23, 24, 25**

## Decisions So Far

- Backend: NestJS + Drizzle ORM (ADR-0001)
- Hot Storage: Self-hosted ClickHouse on Dokploy (ADR-0002) — now `apps/api/src/common/clickhouse` + `apps/api/src/common/db/clickhouse`
- Cold Storage: Cloudflare R2 + Parquet (ADR-0002) — now `apps/api/src/common/data-archival`
- Event Bus: NATS JetStream — now `apps/api/src/common/nats`
- Pricing: Pure pay-as-you-go (ADR-0003)
- AI: Evidence-gated responses (ADR-0004)
- Tenancy: Shared DB with RLS (ADR-0005)
- Auth: Better Auth — now `apps/api/src/modules/v1/auth`
- Frontend: TanStack Start + React + Tailwind + shadcn/ui — now `apps/ui` (moved from `packages/frontend`)
- Monorepo: `apps/*` only (`packages/` cleaned, `pnpm-workspace.yaml` → `apps/*`), `tsconfig/` at root, `apps/sdk` (moved from `packages/sdk`), `apps/api/src/shared` + `apps/ui/src/shared` (moved from `packages/shared`), `find*` → `get*` in repositories

## Fog

- Exact ClickHouse schema design (needs ticket 08)
- Exact SDK API surface (needs ticket 10)
- Exact AI prompt engineering (needs ticket 12)
- Exact RBAC permission matrix (needs ticket 15)
