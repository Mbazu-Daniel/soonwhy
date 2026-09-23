# Soonwhy Node SDK validation examples

These examples are the 4C validation surface for the Node SDK.

The intended flow is:

`application -> @soonwhy/sdk/node -> OTLP traces -> Soonwhy ingestion -> detection -> finding`

OpenTelemetry recommends initializing the Node SDK before application modules are loaded so instrumentation can patch the libraries that create spans. For ESM applications, use Node's `--import` mechanism when the runtime requires initialization before application code.

## Setup

From `examples/node`:

```bash
pnpm install
pnpm build:sdk
```

The examples expect a running Soonwhy ingestion service and a valid project API key.

Set:

```bash
export SOONWHY_API_KEY=...
export SOONWHY_ENDPOINT=http://localhost:3002/v1
```

The endpoint points at the OTLP ingestion base. The Node SDK appends `/traces`.

## Express

Run:

```bash
pnpm tsx express.ts
```

Then request:

```bash
curl http://localhost:3000/slow
curl http://localhost:3000/failure
```

Expected telemetry:

- inbound HTTP spans
- Express route spans
- downstream dependency spans when a dependency is called
- error status for the failure route
- service/resource metadata

## NestJS

Run:

```bash
pnpm tsx nestjs.ts
```

Then:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/failure
```

Expected telemetry:

- HTTP spans
- NestJS controller spans
- exception/error information
- the same service/resource metadata as Express

## PostgreSQL and Redis

The Node SDK enables PostgreSQL, Redis, and ioredis instrumentation by default.

Use the dependency example with real clients:

```bash
pnpm tsx dependencies.ts
```

The validation scenario covers:

1. HTTP request enters the application.
2. Application queries PostgreSQL.
3. Application reads/writes Redis.
4. Downstream HTTP is issued.
5. Spans retain the same trace context across those boundaries.
6. Database statements are constrained to avoid exporting query parameter values.

## Failure and latency scenarios

The examples intentionally include:

- a slow route
- an application error
- a dependency timeout
- a successful dependency call
- a PostgreSQL/Redis operation

These scenarios should be visible as correlated traces in the Soonwhy ingestion pipeline. Detection remains downstream of telemetry collection; the SDK does not decide whether a bottleneck or finding exists.
