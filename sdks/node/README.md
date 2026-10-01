# Soonwhy Node SDK

OpenTelemetry-based server SDK with automatic HTTP, Express, NestJS, PostgreSQL, Redis and ioredis instrumentation.

Install the SDK together with the OpenTelemetry packages it uses:

```bash
pnpm add @soonwhy/node \
  @opentelemetry/api \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-proto \
  @opentelemetry/resources \
  @opentelemetry/sdk-node \
  @opentelemetry/sdk-trace-base
```

```ts
import { initNode } from '@soonwhy/node';

const sdk = initNode({
  apiKey: process.env.SOONWHY_API_KEY!,
  serviceName: 'payments-api',
});

await sdk.shutdown();
```

Initialize the SDK before application modules are loaded so OpenTelemetry can patch supported libraries. For ESM applications, load it through Node's `--import` mechanism when startup ordering requires it.

The OpenTelemetry packages are optional peer dependencies so the application owns their versions.
