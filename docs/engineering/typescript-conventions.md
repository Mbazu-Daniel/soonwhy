# TypeScript Conventions

## Principles

- TypeScript strict mode is non-negotiable — no exceptions.
- Prefer explicit types over inference when the intent is unclear.
- Treat `any` as a compiler error to suppress, not a feature to use.
- Types are documentation; they should be readable and intentional.

---

## Strict Mode

All packages use TypeScript strict mode. The relevant `tsconfig.json` settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Key implications:

- `strictNullChecks` — `null` and `undefined` are distinct types. No implicit nullability.
- `strictFunctionTypes` — function parameter types are checked contravariantly.
- `noImplicitAny` — parameters and return types must be declared.
- `noImplicitThis` — `this` must have an explicit type.

Frontend adds `isolatedModules: true` and `noEmit: true` (bundler handles compilation). Backend adds `emitDecoratorMetadata` and `experimentalDecorators` for NestJS.

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Variables, functions, methods | camelCase | `userName`, `fetchTelemetry` |
| Types, interfaces, classes, React components | PascalCase | `User`, `TelemetryEvent`, `AppController` |
| Database columns | snake_case | `created_at`, `org_id` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_VERSION` |
| File names (backend modules) | dot-separated | `auth.service.ts`, `user.controller.ts` |
| File names (frontend components) | PascalCase | `Button.tsx`, `MetricCard.tsx` |
| File names (frontend utils/hooks) | camelCase | `useAuth.ts`, `formatDate.ts` |

### Naming rules

- Use `I` prefix for interfaces **only** when the interface name conflicts with a class (rare). Otherwise, just use PascalCase: `User`, `TelemetryEvent`.
- Prefix boolean variables with `is`, `has`, `can`, `should`: `isLoading`, `hasPermission`.
- Prefix event handlers with `handle` or `on`: `handleSubmit`, `onChange`.
- React hooks start with `use`: `useAuth`, `useTelemetry`.

---

## File Organization

### Backend — feature-based modules

```
packages/backend/src/
├── main.ts
├── app.module.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.guard.ts
│   └── auth.service.test.ts
├── projects/
│   ├── projects.module.ts
│   ├── projects.controller.ts
│   ├── projects.service.ts
│   └── projects.service.test.ts
└── lib/
    ├── database.ts
    ├── nats.ts
    └── redis.ts
```

Each feature directory is a NestJS module: `*.module.ts`, `*.controller.ts`, `*.service.ts`. Tests are co-located: `*.service.test.ts` for unit, `*.integration.test.ts` for integration.

### Frontend — feature-based with shared lib

```
packages/frontend/app/
├── routes/             # TanStack Router file-based routes
│   ├── __root.tsx
│   └── index.tsx
├── components/         # Shared UI components (PascalCase files)
│   ├── Button.tsx
│   └── MetricCard.tsx
├── lib/                # Shared utilities and hooks
│   ├── utils.ts
│   └── useAuth.ts
├── styles/
│   └── globals.css
└── types/              # Shared TypeScript types
    └── index.ts
```

### What goes in `lib/`

- Utility functions (`cn`, `formatDate`)
- Custom hooks (`useAuth`, `useTelemetry`)
- API client wrappers
- Shared type definitions

---

## Import Ordering

Imports are grouped in this order, separated by blank lines:

```ts
// 1. Node/Built-in modules
import { randomUUID } from "node:crypto";
import { join } from "node:path";

// 2. External packages
import { Injectable } from "@nestjs/common";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// 3. Internal packages (workspace)
import { AppService } from "../app.service";
import { db } from "~/lib/database";

// 4. Relative imports
import { buildUser } from "./factories";
```

### Import rules

- Use named imports by default: `import { Injectable } from "@nestjs/common"`.
- Use default imports only when the library exports it that way (e.g., `import React from "react"`).
- Avoid deep imports into other packages unless the package explicitly supports them.
- Never use `import *` — always destructure what you need.
- Use `import type` when importing only types:
  ```ts
  import type { User } from "../types";
  ```
- Use the `~/*` path alias in the frontend for `app/*` imports.

---

## Type vs Interface

### Use `interface` for

- Object shapes that might be extended or implemented
- Props objects for React components
- Public API contracts (request/response types)
- NestJS DTOs and entities

```ts
interface User {
  id: string;
  email: string;
  workspaceId: string;
  createdAt: Date;
}

interface CreateUserRequest {
  email: string;
  password: string;
}
```

### Use `type` for

- Unions and intersections
- Mapped types and conditional types
- Function signatures
- Tuple types
- Aliases that are more readable as types

```ts
type TelemetryLevel = "debug" | "info" | "warn" | "error" | "fatal";

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

type Handler = (event: TelemetryEvent) => Promise<void>;
```

### Never do

```ts
// Don't use type for simple object shapes
type User = { id: string; email: string }; // prefer interface

// Don't use interface for unions
interface TelemetryLevel { "debug" | "info" | ... } // not valid TS
```

---

## Explicit Return Types

Public functions and exported functions must have explicit return types:

```ts
// Explicit return type — good
export function getUser(id: string): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}

// Inferred return type — acceptable for private helpers
function formatName(first: string, last: string) {
  return `${first} ${last}`;
}
```

NestJS controllers always have explicit return types:

```ts
@Get()
getHello(): string {
  return this.appService.getHello();
}
```

---

## `any` Is Forbidden

Never use `any`. When you need to escape the type system:

- Use `unknown` and narrow with type guards
- Use `Record<string, unknown>` for dynamic objects
- Use explicit casting only when you control the source

```ts
// Bad
function parse(input: any) {
  return JSON.parse(input);
}

// Good
function parse(input: unknown): unknown {
  return JSON.parse(input);
}

// Good — narrow before using
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}
```

---

## Discriminated Unions

Use discriminated unions for state that can be in multiple modes. Always use a `kind`, `status`, or `type` discriminant.

### API responses

```ts
type ApiResponse<T> =
  | { status: "success"; data: T }
  | { status: "error"; error: ApiError };
```

### Component state

```ts
type ConnectionState =
  | { kind: "disconnected" }
  | { kind: "connecting"; attempt: number }
  | { kind: "connected"; sessionId: string }
  | { kind: "failed"; error: string; retryable: boolean };
```

### Pattern matching with `switch`

```ts
function handleConnection(state: ConnectionState): string {
  switch (state.kind) {
    case "disconnected":
      return "Not connected";
    case "connecting":
      return `Connecting (attempt ${state.attempt})...`;
    case "connected":
      return `Session: ${state.sessionId}`;
    case "failed":
      return state.retryable
        ? `Failed: ${state.error}, will retry`
        : `Failed: ${state.error}`;
  }
}
```

Narrow exhaustively — every case must be handled. If you add a new variant, TypeScript will force you to update every consumer.

---

## Zod Schemas for Validation

Use Zod for runtime validation of external data (API inputs, env vars, config, deserialized messages). Define the schema and derive the TypeScript type from it.

### Pattern: schema defines the truth

```ts
import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
```

### Validating API input in NestJS

```ts
import { z } from "zod";

const BodySchema = z.object({
  name: z.string().min(1),
  environment: z.enum(["development", "staging", "production"]),
});

@Post()
create(@Body() body: unknown) {
  const result = BodySchema.safeParse(body);
  if (!result.success) {
    throw new UnprocessableEntityException(result.error.message);
  }
  return this.projectsService.create(result.data);
}
```

### Environment variables

```ts
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NATS_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
});

export const env = envSchema.parse(process.env);
```

Fail fast on startup. If env is invalid, the process should crash with a clear error.

### When to use Zod

| Use case | Zod? |
|----------|------|
| API request/response validation | Yes |
| Environment variable parsing | Yes |
| Form inputs (frontend) | Yes |
| Internal function parameters | No — use TypeScript types |
| Database query results (Drizzle) | No — Drizzle provides types |
| Config files (tsconfig, etc.) | No — already typed |

---

## Error Handling

### Backend (NestJS)

Use NestJS exception filters and built-in exceptions:

```ts
import { NotFoundException, BadRequestException } from "@nestjs/common";

// Throw typed exceptions, never raw errors
throw new NotFoundException(`Project ${id} not found`);

// Custom error classes for domain errors
export class InsufficientCreditsError extends Error {
  constructor(readonly required: number, readonly available: number) {
    super(`Insufficient credits: need ${required}, have ${available}`);
    this.name = "InsufficientCreditsError";
  }
}
```

### Frontend (TanStack Start)

Handle errors at the route level using TanStack Router's error boundaries:

```tsx
// In route definition
export const Route = createFileRoute("/dashboard")({
  errorComponent: ErrorComponent,
});

function ErrorComponent({ error }: { error: Error }) {
  // Render user-friendly error UI
}
```

### General rules

- Never swallow errors silently. Log them or rethrow.
- Use `unknown` for catch clause variables and narrow:
  ```ts
  try {
    await riskyOperation();
  } catch (e: unknown) {
    logger.error(getErrorMessage(e));
  }
  ```
- Never throw strings. Always throw `Error` instances or typed subclasses.
- Don't retry in library code; let the caller decide retry strategy.

---

## Linting (oxlint)

The project uses [oxlint](https://oxc-project.github.io/oxlint/) for linting and [oxfmt](https://github.com/aspect-build/oxfmt) for formatting.

### Current rules

```json
{
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "warn",
    "eqeqeq": "error",
    "no-var": "error",
    "prefer-const": "error"
  }
}
```

### Rule explanations

| Rule | Severity | Meaning |
|------|----------|---------|
| `no-unused-vars` | warn | Remove dead code or prefix with `_` |
| `no-console` | warn | Use `logger` instead; `console` is for debugging |
| `eqeqeq` | error | Always use `===` and `!==` |
| `no-var` | error | Use `const` or `let` |
| `prefer-const` | error | Use `const` unless the variable is reassigned |

### Commands

```bash
pnpm lint       # oxlint
pnpm format     # oxfmt
```

### Adding rules

Rules are configured in `oxlint.json` at the project root. When adding a new rule, document why it was added in the commit message.

---

## TypeScript Configuration Notes

### Path aliases

Frontend only — use `~/` for app imports:

```ts
import { cn } from "~/lib/utils";
import type { User } from "~/types";
```

Backend has no path aliases — use relative imports.

### Module resolution

- **Frontend**: `"moduleResolution": "Bundler"` — follows Node ESM resolution rules.
- **Backend**: `"module": "commonjs"` — standard NestJS CJS output.

### Decorator support

Backend enables `emitDecoratorMetadata` and `experimentalDecorators` for NestJS decorators. Do not use the TC39 decorators proposal — NestJS requires the legacy decorator format.

---

## Quick Reference

| Do | Don't |
|----|-------|
| `const` by default | `var` anywhere |
| `===` | `==` |
| `unknown` for untrusted data | `any` as a crutch |
| `interface` for object shapes | `type` for everything |
| `import type` for type-only imports | Importing types as values |
| Zod for external validation | Trusting `as` casts on unknown data |
| Discriminated unions for state | Stringly-typed mode flags |
| Explicit return types on exports | Letting TypeScript guess public APIs |
| Feature-based file organization | Flat files or layer-based grouping |
