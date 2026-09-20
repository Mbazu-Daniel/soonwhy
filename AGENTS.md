# SoonWhy

## Project overview

Full-stack TypeScript monorepo with TanStack Start (frontend) and NestJS (backend).

## Agent skills

### Git hygiene

Prevents AI agents from poisoning git history. Hardcodes author/committer, blocks third-party attribution trailers, wires pre-commit/commit-msg hooks. See `.agents/skills/git-hygiene/SKILL.md`.

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

## Structure

```
packages/
├── frontend/   # TanStack Start + React + Tailwind + shadcn/ui
└── backend/    # NestJS API
```

## Engineering Conventions

### TypeScript

- Strict mode non-negotiable (`strictNullChecks`, `noImplicitAny`, `noUncheckedIndexedAccess`).
- `any` is forbidden — use `unknown` and narrow with type guards.
- Use `interface` for object shapes, `type` for unions/mapped types/function signatures.
- Explicit return types on exported/public functions.
- Zod for runtime validation of external data (API inputs, env vars); derive types with `z.infer`.
- Discriminated unions with `kind`/`status`/`type` discriminant for multi-mode state.
- Import order: node built-ins → external packages → workspace internal → relative. Use `import type` for type-only imports.
- Naming: camelCase (vars/fns), PascalCase (types/components), UPPER_SNAKE_CASE (constants), snake_case (DB columns).
- Full spec: `docs/engineering/typescript-conventions.md`

### React

- Functional components only — no class components.
- Components as thin rendering shells; extract logic into custom hooks.
- TanStack Query for all server state — never fetch in `useEffect`.
- React Hook Form + Zod for form handling.
- Routes: default exports; components/hooks: named exports. Props interface as `{ComponentName}Props`.
- No global state libraries (Redux, Zustand, etc.) — TanStack Query + local state.
- Tailwind CSS with `cn()` for conditional classes; no inline `style`. Use shadcn/ui primitives from `components/ui/` (never edit directly).
- WCAG 2.1 AA baseline: semantic HTML, keyboard accessible, proper ARIA, contrast ratios.
- Every route must have an `errorComponent`. Always show loading skeletons, never blank screens.
- Full spec: `docs/engineering/react-conventions.md`

### Testing

- Vitest for unit tests, co-located with source (`*.service.test.ts`).
- Integration tests against real databases via Testcontainers; verify tenant isolation.
- Playwright for E2E on critical revenue/onboarding flows only.
- Prefer real implementations over mocks; mock only at system boundaries (external APIs, time, FS).
- Use factory functions (`buildUser()`) for test data; transactions rolled back between tests.
- Coverage: 80% business logic, 60% overall, 100% critical E2E flows.
- Full spec: `docs/engineering/testing-strategy.md`

### Git

- Branching: `main` → `dev` → topic branches (`feature/*`, `fix/*`, `chore/*`).
- Conventional commits: `<type>(<scope>): <description>` — imperative mood, lowercase, max 72 chars.
- PRs target `dev`, squash merge. `dev` → `main` uses merge commit.
- Topic branch naming: `type/short-description`, kebab-case, under 50 chars.
- CI must pass: lint, format, typecheck, test, build.
- Full spec: `docs/engineering/git-strategy.md`

### Error Handling

- Three error layers: Domain (4xx), Application (5xx), Infrastructure (500).
- All errors extend `AppError` (abstract base) — never throw raw `Error` in business logic.
- API responses follow RFC 7807 Problem Details format with `type`, `title`, `status`, `detail`.
- Throw in business logic layer, catch in controller, format response, log with context.
- Never expose stack traces, internal service names, or DB details to clients.
- Retryable: `RateLimitError`, `ExternalServiceError`, `TimeoutError` — exponential backoff with jitter.
- Full spec: `docs/engineering/error-handling.md`

### NestJS Backend Architecture

#### Folder Structure

```
packages/backend/src/
├── main.ts                    # Bootstrap, global pipes/filters
├── app.module.ts              # Root module wiring
├── common/                    # Non-module code (guards, middleware, decorators, filters, pipes)
│   ├── config/                # App-level config (better-auth.config.ts)
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── middleware/
│   └── pipes/
├── db/                        # Database layer
│   ├── index.ts               # Drizzle client
│   ├── migrate.ts             # Migration runner
│   ├── migrations/            # Auto-generated migrations (one per schema)
│   └── schema/                # All Drizzle schemas (exported from index.ts)
├── redis/                     # Redis connection module
├── auth/                      # Better Auth integration
│   ├── auth.module.ts
│   ├── auth.service.ts
│   └── auth.controller.ts
└── modules/
    └── v1/                    # All feature modules live here (versioned)
        ├── organizations/
        │   ├── organizations.module.ts
        │   ├── organizations.controller.ts
        │   ├── organizations.service.ts
        │   ├── organizations.repository.ts
        │   └── dto/
        │       ├── create-organization.dto.ts
        │       └── update-organization.dto.ts
        ├── projects/
        ├── environments/
        ├── services/
        ├── api-keys/
        └── health/
```

#### Rules

1. **All feature modules live in `modules/v1/`** — versioned for API evolution.
2. **Non-module code goes in `common/`** — guards, middleware, decorators, filters, pipes.
3. **Database schemas in `db/schema/`** — exported from a single `index.ts`.
4. **Migrations in `db/migrations/`** — one migration per schema file, clean names.
5. **All IDs are UUIDv7** — `crypto.randomUUIDv7()` generated at the Drizzle schema level via `$defaultFn`. `generateId: false` in Better Auth config.
6. **Entity-based modularity** — each entity's logic lives in its own module. Organization CRUD belongs in `modules/v1/organizations/`, NOT in `auth/`. Auth module only handles sign-up, sign-in, sign-out, session.
7. **Never use `forwardRef`** — if you need circular dependency, the module split is wrong. Redesign the dependency graph instead.
8. **Never use `useEffect` for data fetching** — use TanStack Query (`useQuery`/`useMutation`). `useEffect` is only for side effects like subscriptions or DOM manipulation.

#### Repository Pattern

- **Repository**: Handles all database queries. Methods use `find*` naming.
  - `findOrganizationById(id)` → returns entity or null
  - `findOrganizationsByUserId(userId)` → returns array
  - `findOrganizationBySlug(slug)` → returns entity or null

- **Service**: Business logic layer. Methods use `get*`, `create*`, `update*`, `delete*` naming with entity qualifier.
  - `getOrganizationById(id)` → throws if not found
  - `getOrganizationsForUser(userId)` → returns array
  - `createOrganization(userId, dto)` → returns created entity
  - `updateOrganization(orgId, dto)` → returns updated entity
  - `deleteOrganization(orgId)` → void

#### DTOs

- **Always create DTOs** for request bodies, query params, and response shapes.
- Use Zod schemas in `dto/` folder within each module.
- DTOs are the source of truth for API contracts.
- Export DTO types for service layer consumption.

```typescript
// dto/create-organization.dto.ts
import { z } from 'zod';

export const CreateOrganizationDto = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationDto>;
```

#### Method Naming

- Never use bare `create`, `update`, `delete`, `find`, `get`.
- Always qualify with entity name: `createOrganization`, `getApiKeyById`, `deleteEnvironment`.
- Service methods must be self-explanatory from the name alone.

#### Authentication

- **Better Auth** with organization plugin for multi-tenancy.
- **Argon2** for password hashing (not bcrypt).
- Account verification enabled (email verification required).
- Session-based auth with JWT fallback for API keys.
