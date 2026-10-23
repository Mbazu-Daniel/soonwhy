# Soonwhy Express SDK

```ts
import { initExpress } from '@soonwhy/express';
const sdk = initExpress({apiKey:process.env.SOONWHY_API_KEY!,serviceName:'api'});
```

The integration enables HTTP and Express OpenTelemetry instrumentation and delegates lifecycle to the Node SDK.