# SoonWhy

## Project overview

Full-stack TypeScript monorepo with TanStack Start (frontend) and NestJS (backend).

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

- `pnpm dev` — start both frontend and backend
- `pnpm build` — build all packages
- `pnpm test` — run vitest
- `pnpm lint` — run oxlint
- `pnpm format` — run oxfmt

## Git: branches and commits

Name branches and commit messages from **what the code does**, not from planning folders or epic labels.

- Prefer: `feat/clickhouse-client`, `fix/auth-session-expiry`, `feat: add ClickHouse client`
- Avoid: `phase-2`, `phase1`, `epic-3`, framework labels (`nestjs-module`), scratch path slugs like `02-clickhouse-module` as the whole name
- `.scratch/phase-N/` (and similar) is local planning only — never copy that into a branch name, commit subject, or PR title
- When creating a branch or committing, derive the slug from the capability or bug fixed, not from the ticket directory, phase number, or framework/boilerplate type

## Structure

```
packages/
├── frontend/   # TanStack Start + React + Tailwind + shadcn/ui
└── backend/    # NestJS API
```
