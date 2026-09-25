# SoonWhy

## Project overview

Full-stack TypeScript monorepo with TanStack Start (frontend) and NestJS (API), with shared infrastructure and telemetry ingestion packages.

## Agent skills

### Git hygiene

Prevents AI agents from poisoning git history. Hardcodes author/committer, blocks third-party attribution trailers, wires pre-commit/commit-msg hooks. Also: name branches and commits from the code change, not phase/epic/scratch labels. See `.agents/skills/git-hygiene/SKILL.md`.

### Test pruning

Multi-model approach to pruning test suites without single-model bias. Uses multiple AI models to explain, justify, and stack rank tests by value. See `.agents/skills/test-pruning/SKILL.md`.

### Issue tracker

Local markdown issues in `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout. See `docs/agents/domain.md`.

## Development

- `pnpm dev` — start the frontend, API, and runtime packages
- `pnpm build` — build the shared package, apps, cron, and ingestion packages
- `pnpm test` — run Vitest
- `pnpm lint` — run oxlint
- `pnpm format` — run oxfmt

## Git: branches and commits

**RULE: Branch names and commit messages describe what the code does. Never use phase numbers, epic labels, ticket filenames, or planning folder slugs.**

| Bad | Good |
| --- | --- |
| `feat/phase-2` | `feat/clickhouse-client` |
| `feat/phase3-dashboard` | `feat/dashboard-ui` |
| `fix/phase-1-issue-04` | `fix/auth-session-expiry` |
| `02-clickhouse-module` | `feat/clickhouse-client` |

- `.scratch/phase-N/` is local planning only — never leak it into branch names, commit subjects, or PR titles
- Derive the slug from the **capability** or **bug fixed**, not from the ticket directory, phase number, or framework type
- Before pushing, ask: "Would a stranger understand what this branch does from the name alone?" If not, rename it

## Structure

```
apps/
├── api/          # NestJS API
└── ui/           # TanStack Start + React frontend

packages/
├── shared/       # shared infrastructure clients and types
├── ingest/       # OTLP ingestion service
├── cron/         # scheduled jobs
└── tsconfig/     # shared TypeScript configuration
```
