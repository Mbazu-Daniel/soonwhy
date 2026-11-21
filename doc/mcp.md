# Soonwhy MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server so AI assistants (Claude Code, Codex, Cursor) can investigate a project's telemetry. It is read-only by default; a key can opt in to two write tools. It lives in the `@soonwhy/mcp` package (`packages/mcp`), is built on `@nestjs/mcp`, and is served by the API at `/api/v1/mcp` over Streamable HTTP.

## Contents

1. [Connect](#connect)
2. [Tools](#tools)
3. [Architecture](#architecture)
4. [How a call is served](#how-a-call-is-served)
5. [Authentication and scoping](#authentication-and-scoping)
6. [The `@soonwhy/mcp` package](#the-soonwhymcp-package)
7. [Wiring it into a host app](#wiring-it-into-a-host-app)
8. [Adding a tool](#adding-a-tool)
9. [Testing](#testing)
10. [Security notes](#security-notes)
11. [Appendices](#appendices)
12. [References](#references)

## Connect

1. In the project, open **Settings → API keys → Create key** and tick **Allow read access over MCP**. The key gets the `mcp:read` scope. Tick **Also allow changes over MCP** to add `mcp:write` (it requires `mcp:read`). Ingestion keys have no scopes and cannot use MCP.
2. Add the server to your assistant:

```sh
claude mcp add --transport http soonwhy https://YOUR_API_HOST/api/v1/mcp \
  --header "Authorization: Bearer YOUR_KEY"
```

Other clients: see [Appendix B](#appendix-b-client-configuration).

A key is bound to one project. The organisation and project always come from the key, never from tool arguments, so an assistant cannot read another project.

## Tools

| Tool | Use |
|---|---|
| `list_findings` | Problems Soonwhy already detected, with evidence |
| `get_rca` | The latest root cause analysis already generated for a finding (never creates one) |
| `list_error_groups` | Grouped errors with counts, newest first |
| `get_error_group` | One group: application frames, cause chain, latest occurrences, timeline |
| `list_logs` | Logs, filterable by trace, level, service, text |
| `list_traces` / `get_trace` | Traces and the spans of one |

The first seven are read-only (`readOnlyHint: true`). The write tools need the `mcp:write` scope:

| Tool | Use |
|---|---|
| `set_finding_status` | Set a finding to `open`, `resolved` or `ignored`. Idempotent |
| `request_rca` | Generate a root cause analysis if none exists, else return the existing one. Never regenerates. Uses the organisation's AI quota |

Write tools are marked `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`. A read-only key can see them listed, but a call is refused with 403 before reaching the host.
 Every result has a `status` of `available`, `empty` or `unavailable`: empty means the query ran and found nothing, unavailable means it failed. Input schemas are in [Appendix A](#appendix-a-tool-input-schemas).

## Architecture

The package owns the MCP surface. The host app (`apps/api`) owns the data and the credentials. They meet at six ports, each an injection token.

```
 MCP client (Claude Code, Codex, Cursor)
        │  Streamable HTTP, Authorization: Bearer <key>
        ▼
 apps/api ── McpServerModule
        │      └─ SoonwhyMcpModule.register({ host: McpHostModule })
        ▼
 packages/mcp (@soonwhy/mcp)
   McpApiKeyGuard ──► MCP_AUTHENTICATOR ─┐
   McpErrorsTools ──► MCP_ERRORS_PORT ───┤
   McpTelemetryTools ► MCP_TELEMETRY_PORT┤   implemented by McpHostModule
   McpFindingsTools ─► MCP_FINDINGS_PORT ┤   in apps/api (adapters over
   McpFindingsTools ─► MCP_RCA_PORT ─────┤
   McpActionsTools ──► MCP_ACTIONS_PORT ─┘   investigation-tools services)
```

The package never imports from `apps/api`. The dependency points one way: `apps/api → @soonwhy/mcp`. The tool input schemas live in the package because they are the tool contract; `apps/api` re-exports them for the in-app investigation chat, which exposes the same seven read tools.

## How a call is served

1. The client sends a Streamable HTTP request to `/api/v1/mcp`.
2. `McpApiKeyGuard` asks `MCP_AUTHENTICATOR` to validate the bearer key with the `mcp:read` scope. A bad key gives 401, a key without the scope gives 403. On success the guard attaches an `McpPrincipal` (`orgId`, `projectId`, `scopes`) to the request.
3. The MCP SDK validates the arguments against the tool's JSON Schema. Invalid arguments never reach the tool; the model is told what is wrong.
4. The tool reads the principal from the request context and calls its port with `(scope, args)`.
5. The host runs the query and returns an evidence result (`available` / `empty` / `unavailable`), which becomes the tool result.

Nothing is kept between requests, so the server runs on any number of API instances.

## Authentication and scoping

- Credential: a project API key with the `mcp:read` scope (`MCP_READ_SCOPE`). The host maps it to a principal in `McpApiKeyAuthenticator` (`apps/api/src/modules/v1/investigation/mcp`).
- Scope of data: `orgId` and `projectId` come only from the principal. No tool accepts either as an argument.
- Writes: `mcp:write` is checked per tool (`writerOf` in the package). Status changes made over MCP are recorded without a user id, since a key is not a user.
- Not implemented: OAuth 2.1 (`auth` option of `@nestjs/mcp`). API keys were chosen because assistants are configured per project, not per user. See [Appendix D](#appendix-d-future-work).

## The `@soonwhy/mcp` package

```
packages/mcp/src
├── index.ts                       public API
├── soonwhy-mcp.module.ts          SoonwhyMcpModule.register({ host })
├── mcp-tools.module.ts            registers the tool providers against the host
├── domain/
│   ├── mcp.constants.ts           name, version, path, scope, instructions, limits
│   ├── mcp.tokens.ts              the six injection tokens
│   ├── mcp.types.ts               principal, request, port interfaces
│   ├── mcp-tool.schemas.ts        Zod 4 input schemas for the nine tools
│   └── mcp-principal.ts           reads the principal from the call context
├── application/                   @Tool() providers (errors, telemetry, findings, actions)
└── presentation/
    ├── mcp-api-key.guard.ts       authenticates and attaches the principal
    ├── mcp-api-key.guard.test.ts
    └── mcp.e2e.test.ts            real MCP client against a real HTTP server
```

Public exports: `SoonwhyMcpModule`, the constants, the tokens, the types and the schemas.

Build and test:

```sh
pnpm --filter @soonwhy/mcp build
pnpm --filter @soonwhy/mcp test
```

`apps/api` consumes the built `dist`, like `@soonwhy/shared`, so the package must be built before the API. The root `test` script, `Dockerfile` and `Dockerfile.stack` do this.

Schemas need Zod 4.2 or later, as `@nestjs/mcp` refuses Zod 3. The package depends on `zod` aliased to Zod 4; `apps/api` keeps its own `zod4` alias for the same major version.

## Wiring it into a host app

A host provides a module that exports the six tokens:

```ts
@Module({
  imports: [ApiKeysModule, InvestigationToolsModule],
  providers: [
    McpApiKeyAuthenticator,
    { provide: MCP_AUTHENTICATOR, useExisting: McpApiKeyAuthenticator },
    { provide: MCP_ERRORS_PORT, useExisting: ErrorsInvestigation },
    { provide: MCP_TELEMETRY_PORT, useExisting: TelemetryInvestigation },
    { provide: MCP_FINDINGS_PORT, useExisting: FindingsInvestigation },
    { provide: MCP_RCA_PORT, useExisting: RcaInvestigation },
    { provide: MCP_ACTIONS_PORT, useExisting: McpActionsAdapter },
  ],
  exports: MCP_HOST_TOKENS,
})
export class McpHostModule {}
```

then registers the server:

```ts
@Module({ imports: [SoonwhyMcpModule.register({ host: McpHostModule })] })
export class McpServerModule {}
```

## Adding a tool

1. Add its input schema to `mcp-tool.schemas.ts`.
2. Add a method to the relevant port interface in `mcp.types.ts` (or a new port plus token in `mcp.tokens.ts` and `MCP_HOST_TOKENS`).
3. Add a `@Tool()` method in `application/`, with `readOnlyHint: true`. Take the scope from `principalOf(ctx)`.
4. Implement the port method in the host.
5. Add it to the expected list in `mcp.e2e.test.ts`, and to [Appendix A](#appendix-a-tool-input-schemas).

Keep new tools read-only unless there is a clear need. A write tool goes in `mcp-actions.tools.ts`, uses `writerOf(ctx)`, and should be idempotent and non-destructive; anything destructive needs a separate scope and a decision on confirmation.

## Testing

- `mcp-api-key.guard.test.ts`: the guard asks for the read scope, attaches the principal, and propagates 401 and 403.
- `mcp.e2e.test.ts`: starts a Nest app with fake ports, connects with `@modelcontextprotocol/client` over Streamable HTTP, and checks: unknown key and missing scope are rejected, only the two write tools are non-read-only, a read-only key cannot run them, a writer can, a bad status is refused, the principal (not arguments) is passed to the host, out-of-range arguments are refused before the host runs, and a host result reaches the client.
- Database: five files in `apps/api/test/mcp/` run through a real MCP client against Postgres. `mcp-write` covers resolve and reopen, idempotency, read-only keys and cross-project isolation. `mcp-rca` covers `request_rca` with the real RCA service, storage and metering and only the model stubbed: it stores one row, returns the stored one on a repeat call, stores nothing on a model failure, and refuses unsupported or other-project findings. `mcp-real-keys` uses real hashed API keys: writer, reader, ingestion, expired, unknown and another project's key. `mcp-quota` enforces a real per-organisation `rca_invocations` limit (`SOONWHY_AI_QUOTA_ENFORCED=true`): the call over the limit is refused, the model is not called, nothing is stored, a `quota_exceeded` billing event is recorded, and an already stored analysis is still returned. `mcp-live-ai` is opt-in (`RUN_LIVE_AI=1`, `DEEPSEEK_API_KEY` set, optional `LIVE_AI_MODEL`, default `deepseek-v4-flash`): it stores the key as an encrypted organisation credential and runs `request_rca` against the real model, checking the stored analysis and the recorded token cost. One run costs about $0.001. The app reads AI keys from stored organisation credentials, not from `.env`; the test copies the env key into one. Run it with `RUN_DB_TESTS=1 pnpm --filter @soonwhy/backend exec vitest run --config vitest.e2e.config.ts test/mcp`, with `TEST_DATABASE_URL` pointing at a throwaway database.
- Real assistant: Claude Code (`claude -p` with `--mcp-config` and `--strict-mcp-config`) was pointed at a locally running API with a real signed-up user, organisation, project and an `mcp:read`+`mcp:write` key. It listed findings, requested an RCA from DeepSeek, resolved the finding and reopened it. This showed that `list_findings` must include each finding's `status` and `category`, which it now does.
- Host-side: `investigation-chat.module.test.ts` boots `McpServerModule` together with the chat module to catch wiring errors.

## Security notes

- Telemetry text is untrusted. The server instructions tell the model not to follow instructions found in logs, errors or traces, and results carry `trust: "untrusted_telemetry"`.
- The server checks the HTTP `Origin` against `localhost` by default (`@nestjs/mcp` `http.allowedOrigins`). Non-browser assistants send none and pass.
- Stack traces need `@soonwhy/node` 0.1.1 or later. HTTP status errors have no stack.
- Keys can be revoked in **Settings → API keys**; the next request fails.

---

## Appendices

### Appendix A: Tool input schemas

Source: `packages/mcp/src/domain/mcp-tool.schemas.ts`. Shared fields:

| Field | Type | Default | Limit |
|---|---|---|---|
| `hours` | integer | 24 | 1 to 168 |
| `limit` | integer | 20 | 1 to 50 |
| `service` | string, optional | | max 200 characters |

| Tool | Arguments |
|---|---|
| `list_error_groups` | `hours`, `limit`, `service` |
| `get_error_group` | `fingerprint` (1 to 64 chars, from `list_error_groups`), `hours` |
| `list_logs` | `hours`, `limit`, `service`, `level` (`debug`, `info`, `warn`, `error`, `fatal`), `traceId` (max 64), `query` (max 200) |
| `list_traces` | `hours`, `limit`, `service`, `query` (max 200) |
| `get_trace` | `traceId` (1 to 64 chars) |
| `list_findings` | `limit` |
| `get_rca` | `findingId` (1 to 64 chars, from `list_findings`) |
| `set_finding_status` | `findingId`, `status` (`open`, `resolved`, `ignored`). Needs `mcp:write` |
| `request_rca` | `findingId`. Needs `mcp:write` |

### Appendix B: Client configuration

Claude Code:

```sh
claude mcp add --transport http soonwhy https://YOUR_API_HOST/api/v1/mcp \
  --header "Authorization: Bearer YOUR_KEY"
```

Generic JSON (clients that read an `mcpServers` map, such as Cursor):

```json
{
  "mcpServers": {
    "soonwhy": {
      "url": "https://YOUR_API_HOST/api/v1/mcp",
      "headers": { "Authorization": "Bearer YOUR_KEY" }
    }
  }
}
```

The UI's connection snippets are generated from `apps/ui/src/lib/mcp-clients.ts`.

### Appendix C: Result and error reference

| Situation | What the client sees |
|---|---|
| Query ran, no rows | Tool result with `status: "empty"` |
| Query failed (storage down, timeout) | Tool result with `status: "unavailable"` and a generic `reason`; internal error text is not leaked |
| Output too large | `truncated: true` on the result; text fields are clipped |
| Arguments fail the schema | MCP error from the SDK, naming the invalid field; the tool does not run |
| Missing or unknown key | HTTP 401 |
| Key without `mcp:read` | HTTP 403 |
| Write tool called with a key lacking `mcp:write` | Tool error (403), host not called |

Result envelope (`EvidenceResult<T>`): `status`, `observedAt`, `trust`, `truncated`, optional `reason`, `data`.

### Appendix D: Future work

- OAuth 2.1 on the endpoint (`auth.verifier`, `auth.resource`) for per-user access.
- MCP resources for stable objects (a finding, an error group) and prompts for common investigations ("explain this finding").
- stdio transport for local use against a dev stack.
- Per-key rate limiting on the MCP route (do this before enabling writes widely).
- A user id on MCP-made changes, once OAuth identifies a person.

### Appendix E: Glossary

| Term | Meaning |
|---|---|
| MCP | Model Context Protocol, the open protocol assistants use to reach tools and data |
| MCP server / client | The application exposing capabilities / the assistant consuming them |
| Tool | An action a model calls with validated arguments |
| Resource | Data a client reads by URI |
| Prompt | A template a user picks |
| Streamable HTTP | MCP's HTTP transport: POST requests with optional server-sent event responses |
| Principal | The org, project and scopes derived from the API key |
| Port | An interface and injection token the host implements for the package |
| Host | The app that registers `SoonwhyMcpModule` (`apps/api`) |

---

## References

1. Model Context Protocol. *Introduction and specification.* https://modelcontextprotocol.io
2. Model Context Protocol. *Transports: Streamable HTTP.* https://modelcontextprotocol.io/specification
3. Model Context Protocol. *TypeScript SDK.* https://github.com/modelcontextprotocol/typescript-sdk
4. NestJS. *MCP overview* (`@nestjs/mcp`). https://docs.nestjs.com/mcp/overview
5. NestJS. *`@nestjs/mcp` repository and sample.* https://github.com/nestjs/mcp
6. Standard Schema. *A common interface for TypeScript validation libraries.* https://standardschema.dev
7. Zod. *Zod 4 documentation.* https://zod.dev
8. Anthropic. *Claude Code: connect to tools via MCP.* https://docs.claude.com/en/docs/claude-code/mcp
9. IETF. *OAuth 2.1 (draft-ietf-oauth-v2-1).* https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/ (for the future-work item)

Retrieved from the sources above as linked; check the specification revision before relying on transport details, as MCP is versioned by date.
