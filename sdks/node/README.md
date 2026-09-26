# Soonwhy Node SDK

OpenTelemetry-based server SDK with automatic HTTP, Express, NestJS, PostgreSQL, Redis and ioredis instrumentation.

```ts
import { initNode } from '@soonwhy/node';
const sdk = initNode({apiKey:process.env.SOONWHY_API_KEY!,serviceName:'payments-api'});
await sdk.shutdown();
```

Initialize before application modules are loaded so OpenTelemetry can patch supported libraries.