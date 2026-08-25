# Soonwhy SDK Client Design

## Overview

`@soonwhy/sdk` is a Node.js/TypeScript SDK for instrumenting applications with observability telemetry. It sends traces, spans, logs, and metrics to the Soonwhy Ingestion Worker via HTTP, with automatic batching, retry logic, and fail-open behavior.

**Package:** `npm install @soonwhy/sdk`

---

## Quick Start

```typescript
import { Soonwhy } from "@soonwhy/sdk";

const sw = Soonwhy.init({
  apiKey: "sw_live_xxx",
  service: "my-api",
  environment: "production",
});

// Auto-instrument Express/Fastify/NestJS
sw.instrument();

// Manual spans
const result = await sw.span("process-order", async (span) => {
  span.setAttribute("order.id", orderId);
  const result = await processOrder(orderId);
  span.setStatus({ code: SpanStatusCode.OK });
  return result;
});

// Logs
sw.log("info", "Order processed", { orderId, total: 99.99 });
sw.log("error", "Payment failed", { orderId, reason: "insufficient_funds" });

// Metrics
sw.metric("counter", "orders.created", 1, { region: "us-east-1" });
sw.metric("histogram", "order.duration", durationMs);

// Graceful shutdown
await sw.shutdown();
```

---

## Configuration

### `Soonwhy.init(options)`

```typescript
interface SoonwhyOptions {
  /** API key for authentication (required) */
  apiKey: string;

  /** Service name (required) */
  service: string;

  /** Environment (default: "development") */
  environment: "development" | "staging" | "production";

  /** Ingestion endpoint (default: "https://ingest.soonwhy.dev") */
  endpoint: string;

  /** Enable debug logging (default: false) */
  debug: boolean;

  /** Maximum number of events to batch before flushing (default: 100) */
  batchSize: number;

  /** Flush interval in milliseconds (default: 5000) */
  flushInterval: number;

  /** Maximum payload size in bytes before flush (default: 512KB) */
  maxPayloadSize: number;

  /** Maximum number of retries per failed batch (default: 3) */
  maxRetries: number;

  /** Base delay for exponential backoff in ms (default: 1000) */
  retryBaseDelay: number;

  /** Maximum delay for exponential backoff in ms (default: 30000) */
  retryMaxDelay: number;

  /** Enable W3C Trace Context propagation (default: true) */
  enableContextPropagation: boolean;

  /** Custom headers to include in requests */
  headers: Record<string, string>;

  /** Timeout for ingestion requests in ms (default: 10000) */
  requestTimeout: number;

  /** Enable PII filtering (default: true) */
  enablePIIFiltering: boolean;

  /** Custom attributes added to all events */
  globalAttributes: Record<string, string>;

  /** Shutdown timeout in ms (default: 5000) */
  shutdownTimeout: number;
}
```

---

## SDK API Surface

### Initialization

```typescript
import { Soonwhy } from "@soonwhy/sdk";

const sw = Soonwhy.init({
  apiKey: "sw_live_xxx",
  service: "my-service",
  environment: "production",
});
```

### Auto-Instrumentation

```typescript
sw.instrument({
  http: true,       // Auto-capture HTTP request latency, status codes
  database: true,   // Auto-detect slow queries (>200ms)
  redis: true,      // Auto-capture Redis operation latency, errors
  queues: true,     // Auto-capture queue job processing time, failures
  cron: true,       // Auto-capture cron job execution time, misses
});
```

### Manual Spans

```typescript
import { SpanStatusCode } from "@soonwhy/sdk";

await sw.span("operation-name", async (span) => {
  span.setAttribute("custom.key", "value");
  span.addEvent("checkpoint", { detail: "midpoint" });
  span.setStatus({ code: SpanStatusCode.OK });
  return result;
});

// Synchronous spans
const result = sw.spanSync("sync-op", (span) => {
  span.setAttribute("sync", true);
  return computeResult();
});
```

### Logs

```typescript
// Structured logging
sw.log("info", "User signed in", { userId: "123", method: "oauth" });
sw.log("error", "Database connection failed", { host: "db-primary" });
sw.log("warn", "Rate limit approaching", { current: 95, limit: 100 });
sw.log("debug", "Cache miss", { key: "user:123" });

// Error logging with exception capture
try {
  await riskyOperation();
} catch (error) {
  sw.logException(error, { operation: "risky-operation" });
}
```

### Metrics

```typescript
// Counter
sw.metric("counter", "requests.total", 1, { method: "POST", path: "/api/orders" });

// Gauge
sw.metric("gauge", "connections.active", connectionCount);

// Histogram
sw.metric("histogram", "response.duration", responseTimeMs);

// Summary
sw.metric("summary", "queue.processing_time", processingTimeMs);
```

---

## Auto-Instrumentation

### HTTP (Express, Fastify, NestJS)

Automatically captures:
- Request method, URL, status code
- Request duration (latency histogram)
- Request size, response size
- Error rates
- W3C Trace Context headers

```typescript
// Express
import express from "express";
import { Soonwhy } from "@soonwhy/sdk";

const app = express();
const sw = Soonwhy.init({ apiKey: "...", service: "my-api" });

// Middleware auto-instruments all routes
app.use(sw.instrumentMiddleware());

// Or instrument after routing
app.use(sw.instrumentMiddleware({ captureBody: true }));
```

```typescript
// NestJS
// app.module.ts
import { SoonwhyModule } from "@soonwhy/sdk/nestjs";

@Module({
  imports: [
    SoonwhyModule.forRoot({
      apiKey: process.env.SOWHY_API_KEY,
      service: "my-nestjs-api",
    }),
  ],
})
export class AppModule {}
```

```typescript
// Fastify
import Fastify from "fastify";
import { Soonwhy } from "@soonwhy/sdk";

const app = Fastify();
const sw = Soonwhy.init({ apiKey: "...", service: "my-api" });

app.addHook("onRequest", sw.instrumentFastify());
```

### Database Queries

Auto-detects slow queries (>200ms by default) via monkey-patching:
- `pg` (PostgreSQL)
- `mysql2`
- `mongodb`

```typescript
sw.instrument({
  database: true,
  slowQueryThreshold: 200, // ms
});
```

### Redis

Auto-captures Redis operation latency and errors via `ioredis` and `redis` clients.

### Queue Jobs

Instruments queue processors (BullMQ, Bull):
- Job processing time
- Success/failure counts
- Retry attempts

### Cron Jobs

Instruments `node-cron` and `@nestjs/schedule`:
- Execution time
- Missed executions
- Concurrency violations

---

## Context Propagation

### W3C Trace Context

The SDK implements W3C Trace Context for distributed tracing across services.

**Outbound (auto-injected):**
```typescript
// Automatically injects traceparent/tracestate headers
const response = await fetch("https://other-service/api/data");
// Headers: traceparent: 00-{traceId}-{spanId}-{flags}
```

**Inbound (auto-extracted):**
```typescript
// Automatically extracts trace context from incoming requests
app.get("/api/data", (req, res) => {
  // SDK creates child span from extracted trace context
  // traceparent: 00-abc123-def456-01
});
```

### Context Propagation API

```typescript
// Get current context
const ctx = sw.context();

// Inject context into custom transports
const headers = {};
sw.injectContext(headers);
// headers = { traceparent: "00-..." }

// Extract context from incoming requests
sw.extractContext(headers);
// Creates child span linked to parent

// Baggage (cross-service metadata)
sw.setBaggage("user.id", "123");
sw.getBaggage("user.id"); // "123"
```

---

## Batching and Buffering

### Buffer Management

Events are accumulated in an in-memory buffer. When any of these conditions are met, the buffer is flushed:

1. **Batch size reached:** Buffer contains `batchSize` events (default: 100)
2. **Flush interval elapsed:** `flushInterval` ms since last flush (default: 5s)
3. **Payload size exceeded:** Combined payloads exceed `maxPayloadSize` (default: 512KB)
4. **Shutdown called:** `sw.shutdown()` flushes remaining events

### Buffer Lifecycle

```
Event created → Added to buffer → Buffer full? → Flush to ingestion
                              ↓ (interval)
                         Timer fires → Flush to ingestion
                              ↓ (shutdown)
                         Graceful flush → Exit
```

### Backpressure

If the ingestion endpoint is slow or unavailable, the buffer continues accepting events up to a hard cap (10,000 events). Beyond this, events are dropped and a warning is logged.

---

## Retry Logic

### Exponential Backoff

Failed batches are retried with exponential backoff:

```
Attempt 1: 1000ms delay
Attempt 2: 2000ms delay
Attempt 3: 4000ms delay
(maxDelay: 30000ms)
```

### Retry Behavior

- **4xx errors (except 429):** No retry (client error)
- **429 (rate limited):** Retry after `Retry-After` header value
- **5xx errors:** Retry with exponential backoff
- **Network errors:** Retry with exponential backoff
- **Timeout:** Retry with exponential backoff

### Circuit Breaker

After `maxRetries` consecutive failures, the SDK enters a degraded state:
- Buffers events locally
- Attempts a health check every 60 seconds
- Resumes normal operation when health check passes
- Drops events if buffer exceeds hard cap (10,000)

---

## Fail-Open Behavior

**The SDK never crashes the application.** All failures are caught and handled internally.

```typescript
try {
  sw.log("info", "event");
} catch {
  // Swallowed - app continues
}

try {
  await sw.span("op", async () => { ... });
} catch {
  // Returns undefined if span creation fails
}

try {
  await sw.shutdown();
} catch {
  // Proceeds with exit anyway
}
```

### Failure Scenarios

| Scenario | Behavior |
|----------|----------|
| Ingestion down | Events buffered, retried, then dropped after max retries |
| Invalid API key | Events dropped, warning logged once |
| Network timeout | Retry with backoff, then drop |
| Buffer overflow | New events dropped, warning logged |
| Shutdown fails | Process exits normally |
| Auto-instrumentation fails | Other instruments continue, warning logged |

---

## PII Filtering and Secret Redaction

When `enablePIIFiltering: true` (default), the SDK automatically redacts:

- Email addresses → `[REDACTED_EMAIL]`
- Credit card numbers → `[REDACTED_CARD]`
- SSN → `[REDACTED_SSN]`
- API keys / tokens (if pattern detected) → `[REDACTED_SECRET]`

Custom filter rules:
```typescript
sw.instrument({
  piiFilter: {
    patterns: [/password:\s*\S+/gi],
    replace: "[REDACTED]",
  },
});
```

---

## Payload Limits

| Field | Limit | Behavior |
|-------|-------|----------|
| Event payload | 64KB | Truncated with `[TRUNCATED]` marker |
| Attribute value | 1KB | Truncated |
| Log message | 4KB | Truncated |
| Span name | 256 chars | Truncated |
| Total batch payload | 512KB | Flush triggered |
| Buffer size | 10,000 events | Events dropped |

---

## TypeScript Types

```typescript
// Core SDK instance
interface Soonwhy {
  init(options: SoonwhyOptions): Soonwhy;
  instrument(options?: InstrumentOptions): void;
  span<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>;
  spanSync<T>(name: string, fn: (span: Span) => T): T;
  log(level: LogLevel, message: string, attributes?: Record<string, any>): void;
  logException(error: Error, attributes?: Record<string, any>): void;
  metric(type: MetricType, name: string, value: number, attributes?: Record<string, string>): void;
  context(): TraceContext;
  injectContext(headers: Record<string, string>): void;
  extractContext(headers: Record<string, string>): TraceContext | undefined;
  setBaggage(key: string, value: string): void;
  getBaggage(key: string): string | undefined;
  shutdown(): Promise<void>;
}

// Options
type SoonwhyOptions = {
  apiKey: string;
  service: string;
  environment?: "development" | "staging" | "production";
  endpoint?: string;
  debug?: boolean;
  batchSize?: number;
  flushInterval?: number;
  maxPayloadSize?: number;
  maxRetries?: number;
  retryBaseDelay?: number;
  retryMaxDelay?: number;
  enableContextPropagation?: boolean;
  headers?: Record<string, string>;
  requestTimeout?: number;
  enablePIIFiltering?: boolean;
  globalAttributes?: Record<string, string>;
  shutdownTimeout?: number;
};

type InstrumentOptions = {
  http?: boolean;
  database?: boolean;
  redis?: boolean;
  queues?: boolean;
  cron?: boolean;
  slowQueryThreshold?: number;
  captureBody?: boolean;
  piiFilter?: {
    patterns?: RegExp[];
    replace?: string;
  };
};

// Span
interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  addEvent(name: string, attributes?: Record<string, any>): void;
  setStatus(status: { code: SpanStatusCode; message?: string }): void;
  end(): void;
}

type SpanStatusCode = {
  OK: 0;
  ERROR: 1;
  UNSET: 2;
};

// Logging
type LogLevel = "debug" | "info" | "warn" | "error";

// Metrics
type MetricType = "counter" | "gauge" | "histogram" | "summary";

// Context
interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

// Events (internal)
interface TelemetryEvent {
  type: "log" | "metric" | "span";
  timestamp: string;
  service: string;
  environment: string;
  attributes: Record<string, any>;
  traceId?: string;
  spanId?: string;
}

interface BatchPayload {
  events: TelemetryEvent[];
  metadata: {
    sdkVersion: string;
    batchId: string;
    sentAt: string;
  };
}
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                  Application                     │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ HTTP     │  │ Database │  │ Queue/Cron   │  │
│  │ Auto-    │  │ Auto-    │  │ Auto-        │  │
│  │ Instrument│  │ Instrument│  │ Instrument  │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │           │
│       └──────────────┼───────────────┘           │
│                      │                           │
│              ┌───────▼────────┐                  │
│              │  Soonwhy SDK   │                  │
│              │  - Buffer      │                  │
│              │  - Batch       │                  │
│              │  - Retry       │                  │
│              │  - Context     │                  │
│              └───────┬────────┘                  │
│                      │                           │
└──────────────────────┼───────────────────────────┘
                       │ HTTP POST /api/v1/telemetry/ingest
                       ▼
              ┌────────────────┐
              │  Ingestion     │
              │  Worker        │
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │  NATS JetStream│
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │  Processor     │
              │  Worker        │
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │  ClickHouse    │
              └────────────────┘
```

---

## Installation

```bash
npm install @soonwhy/sdk
```

```bash
yarn add @soonwhy/sdk
```

```bash
pnpm add @soonwhy/sdk
```

---

## Supported Runtimes

- Node.js >= 18
- TypeScript >= 5.0

## Supported Frameworks

- Express >= 4.x
- Fastify >= 4.x
- NestJS >= 10.x
- Hono >= 4.x
