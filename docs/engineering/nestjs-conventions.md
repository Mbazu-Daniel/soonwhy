# NestJS Conventions

## Principles

- Business logic belongs in services, not controllers.
- Controllers are thin: parse input, delegate to services, format output.
- Use Zod for runtime validation of all external input (request bodies, query params, route params).
- Throw typed NestJS exceptions — never raw `Error` in business logic.
- Drizzle ORM for all database access; no raw SQL unless Drizzle cannot express the query.

---

## Module Organization

Feature-based modules. One module per bounded context.

```
packages/backend/src/
├── main.ts
├── app.module.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.guard.ts
│   ├── dto/
│   │   └── login.schema.ts
│   └── auth.service.test.ts
├── projects/
│   ├── projects.module.ts
│   ├── projects.controller.ts
│   ├── projects.service.ts
│   ├── dto/
│   │   └── create-project.schema.ts
│   └── projects.service.test.ts
└── lib/
    ├── database.ts
    ├── nats.ts
    └── redis.ts
```

### Rules

- Each feature module exports only what other modules need via `exports`.
- Shared infrastructure (`database.ts`, `nats.ts`, `redis.ts`) lives in `lib/` and is registered in `AppModule` as global providers.
- Feature modules import shared modules through `AppModule`, not directly.

### `AppModule` wiring

```ts
@Module({
  imports: [
    AuthModule,
    ProjectsModule,
    TelemetryModule,
  ],
})
export class AppModule {}
```

---

## Controllers

One controller per resource. Controllers handle HTTP concerns only.

### File naming

`<feature>.controller.ts` — e.g., `projects.controller.ts`.

### Class conventions

```ts
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}
}
```

- One `@Controller()` per file.
- Constructor injection only — no property injection.
- Explicit return types on every route handler.
- No business logic in controllers — delegate to services immediately.

### Route handlers

```ts
@Get(":id")
async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<Project> {
  return this.projectsService.findById(id);
}

@Post()
async create(@Body() body: unknown): Promise<Project> {
  const input = CreateProjectSchema.parse(body);
  return this.projectsService.create(input);
}
```

- Use `@Param("id", ParseUUIDPipe)` for typed route params.
- Parse `@Body() body: unknown` and validate with Zod inside the handler.
- Always return the service result directly — controllers don't transform responses.

### HTTP method decorators

Use the `@nestjs/common` HTTP method decorators:

- `@Get()` — read
- `@Post()` — create
- `@Patch()` — partial update
- `@Put()` — full replace
- `@Delete()` — remove

### Status codes

Use the `@HttpCode()` decorator when the default isn't appropriate:

```ts
@Post()
@HttpCode(HttpStatus.CREATED)
async create(@Body() body: unknown): Promise<Project> {
  return this.projectsService.create(CreateProjectSchema.parse(body));
}
```

---

## Services

Services contain all business logic.

### File naming

`<feature>.service.ts` — e.g., `projects.service.ts`.

### Class conventions

```ts
@Injectable()
export class ProjectsService {
  constructor(private readonly db: DrizzleDatabase) {}
}
```

- One `@Injectable()` per file.
- Explicit return types on public methods.
- Services never depend on `Req`/`Res` — they are framework-agnostic.

### Business logic rules

- Services throw domain errors (via NestJS exceptions or custom `AppError` subclasses).
- Services never catch and swallow errors silently.
- Services are the only place that touches the database (via Drizzle).
- Services are unit-testable in isolation — inject all dependencies.

---

## Dependency Injection

### Constructor injection (preferred)

```ts
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}
}
```

### Custom providers with `@Inject()`

Use for non-class tokens (config values, database connections, external clients):

```ts
const databaseProvider = {
  provide: "DATABASE_CONNECTION",
  useFactory: () => {
    return drizzle(process.env.DATABASE_URL);
  },
};

@Module({
  providers: [databaseProvider],
})
export class DatabaseModule {}
```

### Global providers

Register shared infrastructure in `AppModule` with `@Global()`:

```ts
@Global()
@Module({
  providers: [
    {
      provide: "DATABASE_CONNECTION",
      useFactory: () => drizzle(process.env.DATABASE_URL),
    },
  ],
  exports: ["DATABASE_CONNECTION"],
})
export class DatabaseModule {}
```

### Tokens

Use `Symbol` for injection tokens when there's no concrete class:

```ts
export const DATABASE_CONNECTION = Symbol("DATABASE_CONNECTION");
```

---

## Guards

Guards handle authorization and cross-cutting access control.

### File naming

`<feature>.guard.ts` — e.g., `auth.guard.ts`, `tenant.guard.ts`.

### Guard conventions

```ts
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException("Missing authentication token");
    }
    const user = this.authService.validateToken(token);
    request.user = user;
    return true;
  }
}
```

- One guard per concern: `AuthGuard`, `TenantGuard`, `RateLimitGuard`.
- Guards throw `UnauthorizedException` or `ForbiddenException` on failure.
- Guards attach validated context to the request object for downstream use.

### Applying guards

Apply at the controller level or per-route:

```ts
@UseGuards(AuthGuard, TenantGuard)
@Controller("projects")
export class ProjectsController {}
```

Or globally in `main.ts`:

```ts
app.useGlobalGuards(new AuthGuard(authService));
```

---

## Interceptors

Interceptors handle cross-cutting concerns: logging, transformation, caching.

### File naming

`<feature>.interceptor.ts` — e.g., `logging.interceptor.ts`.

### Interceptor conventions

```ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`${method} ${url} ${Date.now() - now}ms`);
      }),
    );
  }
}
```

- Interceptors return `Observable<unknown>`.
- Use `map()` to transform responses, `tap()` for side effects (logging, metrics).
- Keep interceptors stateless — no request-scoped state in class properties.

---

## DTO Validation with Zod

All external input is validated with Zod schemas. No class-validator, no `class-transformer`.

### File location

`dto/<feature>.schema.ts` — e.g., `dto/create-project.schema.ts`.

### Schema and type derivation

```ts
import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  environment: z.enum(["development", "staging", "production"]),
  description: z.string().optional(),
});

export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;
```

### Validation in controllers

```ts
@Post()
async create(@Body() body: unknown): Promise<Project> {
  const input = CreateProjectSchema.parse(body);
  return this.projectsService.create(input);
}
```

- Parse `@Body()` as `unknown` — never `any` or a pre-typed DTO class.
- Use `.parse()` for strict validation (throws on failure).
- Use `.safeParse()` when you need to handle errors gracefully without exceptions.

### Validation pipe (alternative)

For a global validation layer, register a Zod pipe:

```ts
// In main.ts
app.useGlobalPipes(new ValidationPipe({ transform: false }));
```

But prefer explicit `.parse()` in controllers for clarity.

---

## Error Handling

### Exception hierarchy

Use NestJS built-in exceptions for standard HTTP errors:

| Exception | Use case |
|-----------|----------|
| `BadRequestException` (400) | Malformed request, missing required fields |
| `UnauthorizedException` (401) | Missing or invalid authentication |
| `ForbiddenException` (403) | Valid auth, insufficient permissions |
| `NotFoundException` (404) | Resource not found |
| `UnprocessableEntityException` (422) | Validation failure |
| `ConflictException` (409) | Resource already exists, state conflict |
| `TooManyRequestsException` (429) | Rate limit exceeded |
| `InternalServerErrorException` (500) | Unexpected server errors (last resort) |

### Custom domain errors

Define domain-specific errors as subclasses of `AppError`:

```ts
export abstract class AppError extends Error {
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InsufficientCreditsError extends AppError {
  readonly statusCode = HttpStatus.PAYMENT_REQUIRED;

  constructor(
    readonly required: number,
    readonly available: number,
  ) {
    super(`Insufficient credits: need ${required}, have ${available}`);
  }
}
```

### Exception filters

For cross-cutting error formatting (RFC 7807 Problem Details), implement an exception filter:

```ts
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ProblemDetails");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = this.extractStatus(exception);
    const body = {
      type: `https://api.soonwhy.com/errors/${this.extractCode(exception)}`,
      title: this.extractTitle(exception),
      status,
      detail: this.extractMessage(exception),
    };

    this.logger.error(`${status} ${body.title}: ${body.detail}`);
    response.status(status).json(body);
  }
}
```

Register in `main.ts`:

```ts
app.useGlobalFilters(new ProblemDetailsFilter());
```

### Rules

- Never swallow errors silently — log them or rethrow.
- Use `unknown` for catch clause variables and narrow with type guards.
- Never throw strings — always `Error` instances or `AppError` subclasses.
- Never expose stack traces or internal details to clients.

---

## Database Access Patterns (Drizzle)

### Connection

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);
```

Register as a global provider:

```ts
{
  provide: "DATABASE_CONNECTION",
  useFactory: () => drizzle(new Pool({ connectionString: process.env.DATABASE_URL })),
}
```

### Query pattern

Inject the database connection into services, never into controllers:

```ts
@Injectable()
export class ProjectsService {
  constructor(@Inject("DATABASE_CONNECTION") private readonly db: DrizzleDatabase) {}

  async findById(id: string): Promise<Project | null> {
    const result = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async create(input: CreateProjectRequest): Promise<Project> {
    const [created] = await this.db
      .insert(projects)
      .values(input)
      .returning();
    return created;
  }
}
```

### Rules

- One database connection pool, shared across all modules.
- Use `select().from(table).where(...)` — avoid raw SQL strings.
- Use Drizzle's type inference for return types — don't duplicate type definitions.
- Wrap writes in transactions when multiple tables are involved:
  ```ts
  await this.db.transaction(async (tx) => {
    await tx.insert(projects).values(projectData);
    await tx.insert(auditLog).values(logData);
  });
  ```
- Always handle the `null` case from `.limit(1)[0]` — use `?? null` or explicit checks.

---

## Testing

### Unit tests

Co-located with source: `auth.service.test.ts`.

```ts
import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService],
    }).compile();

    service = module.get(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
```

### Integration tests

Against real databases via Testcontainers:

```ts
import { TestcontainersModule } from "@nestjs/testing/testcontainers";

const module = await Test.createTestingModule({
  imports: [TestcontainersModule.forDatabase("postgres")],
}).compile();
```

### Rules

- Prefer real implementations over mocks — mock only at system boundaries (external APIs, time, filesystem).
- Use factory functions (`buildUser()`) for test data.
- Roll back transactions between tests — don't clean up with deletes.
- 80% coverage on business logic, 60% overall, 100% on critical E2E flows.

---

## Quick Reference

| Do | Don't |
|----|-------|
| Feature-based modules | Layer-based or flat files |
| Constructor injection | Property injection |
| Zod `.parse(body)` as `unknown` | Trusting typed `@Body()` params |
| Throw `NotFoundException` | Return `null` and let controller decide |
| Services access DB | Controllers access DB |
| One guard per concern | One guard handling auth + rate limiting + tenancy |
| `export type` for derived DTO types | Defining types separately from schemas |
| Explicit return types on public methods | Inferred types on exported functions |
