# Node.js SDK onboarding

## 1. Create a project

In the Soonwhy dashboard:

1. Create or select a project.
2. Create a project API key.
3. Copy the key once and store it as a server-side secret.

The API key authenticates telemetry ingestion. Do not expose it in browser bundles or commit it to source control.

## 2. Install the Node SDK

The generic SDK package exposes the Node integration through `@soonwhy/sdk/node`.

Install the SDK and the OpenTelemetry runtime packages:

```bash
pnpm add @soonwhy/sdk @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/sdk-trace-base @opentelemetry/resources @opentelemetry/exporter-trace-otlp-proto @opentelemetry/auto-instrumentations-node
```

For applications using Express, NestJS, PostgreSQL, Redis, or ioredis, the Node auto-instrumentations package supplies the corresponding instrumentation modules.

## 3. Configure secrets

```env
SOONWHY_API_KEY=sk_...
SOONWHY_ENDPOINT=https://ingest.example.com/v1
```

Never use the API key as a resource attribute.

## 4. Initialize before application dependencies

OpenTelemetry instrumentation must be initialized before the instrumented application modules are loaded. This is particularly important for HTTP, Express, NestJS, PostgreSQL, and Redis instrumentation.

For ESM applications, prefer Node's `--import` mechanism and initialize Soonwhy in a dedicated instrumentation module before loading the application.

Example:

```ts
// instrumentation.ts
import { initNode } from '@soonwhy/sdk/node';

initNode({
  apiKey: process.env.SOONWHY_API_KEY ?? '',
  endpoint: process.env.SOONWHY_ENDPOINT,
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'my-service',
  serviceVersion: process.env.APP_VERSION,
  environment: process.env.NODE_ENV,
  deployment: process.env.DEPLOYMENT_VERSION,
});
```

Start the application with the instrumentation module loaded first:

```bash
node --import ./dist/instrumentation.js ./dist/server.js
```

For TypeScript development, the equivalent depends on the runtime loader being used. The important rule is the ordering: instrumentation first, application modules second.

## 5. Express

No manual spans are required for normal HTTP and Express requests.

```ts
import express from 'express';

const app = express();

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(3000);
```

The SDK automatically instruments the HTTP and Express layers when those integrations are enabled.

## 6. NestJS

Initialize Soonwhy before NestJS modules are imported.

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
await app.listen(3000);
```

The Node integration enables NestJS instrumentation by default.

## 7. PostgreSQL and Redis

PostgreSQL, Redis, and ioredis instrumentation are enabled by default.

The SDK deliberately limits dependency statement data:

- PostgreSQL enhanced database reporting is disabled.
- Redis and ioredis statement serializers retain the command but not command arguments.

This prevents values such as passwords, tokens, and arbitrary Redis payloads from being exported as database statement data.

## 8. Downstream HTTP propagation

The Node integration also instruments Undici/fetch. HTTP trace context can therefore flow from an inbound request through application code to downstream HTTP calls.

The expected trace shape is:

```text
incoming HTTP
  └── application / Express / NestJS
       ├── PostgreSQL
       ├── Redis
       └── downstream HTTP
```

## 9. Errors and shutdown

Unhandled application errors are recorded by the normal OpenTelemetry instrumentation.

For graceful shutdown:

```ts
const sdk = initNode({
  apiKey: process.env.SOONWHY_API_KEY ?? '',
  serviceName: 'my-service',
});

await sdk.shutdown();
```

The SDK can register SIGINT/SIGTERM handlers automatically. Set `registerShutdownHandlers: false` when the application owns the process lifecycle and will call `shutdown()` itself.

## 10. Verify telemetry

After starting the service:

1. Send a request to the application.
2. Trigger a slow request.
3. Trigger an application error.
4. Exercise PostgreSQL or Redis if configured.
5. Make a downstream HTTP request.
6. Open the Soonwhy project and inspect the resulting service telemetry.

The SDK is responsible for collecting and exporting telemetry. Detection, evidence correlation, findings, and RCA remain downstream platform responsibilities.

## 11. Troubleshooting

### No spans

Check that Soonwhy initializes before Express, NestJS, PostgreSQL, Redis, or other instrumented dependencies are loaded.

### Authentication failures

Check:

- `SOONWHY_API_KEY`
- ingestion endpoint
- project/API-key association
- server-side secret configuration

### No PostgreSQL or Redis spans

Check that the application is actually using the instrumented `pg`, `redis`, or `ioredis` client and that the corresponding integration has not been disabled.

### Sensitive values in dependency telemetry

The default Node configuration disables enhanced PostgreSQL reporting and strips Redis/ioredis command arguments. Do not add custom instrumentation that exports secrets as span attributes.

## Validation examples

The repository contains runnable Express, NestJS, PostgreSQL, and Redis validation examples under `examples/node`.
