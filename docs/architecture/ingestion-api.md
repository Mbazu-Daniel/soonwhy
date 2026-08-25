# Soonwhy — Ingestion API

## Overview

The Ingestion API receives telemetry events (logs, metrics, spans) from the SDK or direct HTTP clients, validates them, and publishes to NATS JetStream for downstream processing.

**Base URL:** `https://ingest.soonwhy.dev`
**API Version:** v1

---

## Authentication

All requests require an API key in the `Authorization` header.

```
Authorization: Bearer sw_live_xxx
```

The API key resolves to:
- `org_id` — organization UUID
- `project_id` — project UUID
- `environment` — deployment environment

Invalid or missing keys return `401 Unauthorized`.

---

## Endpoints

### POST /api/v1/telemetry/ingest

Primary ingestion endpoint. Accepts a single event or a batch of events.

#### Single Event

```json
POST /api/v1/telemetry/ingest
Content-Type: application/json
Authorization: Bearer sw_live_xxx

{
  "type": "log",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "my-api",
  "environment": "production",
  "attributes": {
    "level": "info",
    "message": "Order processed",
    "orderId": "12345"
  }
}
```

#### Batch Event

```json
POST /api/v1/telemetry/ingest
Content-Type: application/json
Authorization: Bearer sw_live_xxx

{
  "events": [
    {
      "type": "log",
      "timestamp": "2025-01-15T10:30:00.000Z",
      "service": "my-api",
      "environment": "production",
      "attributes": { "level": "info", "message": "Order processed" }
    },
    {
      "type": "metric",
      "timestamp": "2025-01-15T10:30:01.000Z",
      "service": "my-api",
      "environment": "production",
      "attributes": {
        "metricType": "counter",
        "name": "orders.created",
        "value": 1
      }
    }
  ],
  "metadata": {
    "sdkVersion": "1.0.0",
    "batchId": "b-abc123",
    "sentAt": "2025-01-15T10:30:05.000Z"
  }
}
```

#### Response

```json
HTTP/1.1 202 Accepted

{
  "accepted": 2,
  "batchId": "b-abc123"
}
```

---

## Request Format

### Envelope (Batch)

```typescript
interface BatchPayload {
  events: TelemetryEvent[];
  metadata: {
    sdkVersion: string;
    batchId: string;      // client-generated UUID
    sentAt: string;       // ISO 8601
  };
}
```

### TelemetryEvent

```typescript
interface TelemetryEvent {
  type: "log" | "metric" | "span";
  timestamp: string;                   // ISO 8601
  service: string;                     // max 256 chars
  environment: string;                 // development | staging | production
  attributes: Record<string, any>;     // type-specific fields
  traceId?: string;                    // 32 hex chars
  spanId?: string;                     // 16 hex chars
  parentSpanId?: string;               // 16 hex chars
}
```

---

## Validation Rules

### Common (All Types)

| Field | Required | Rule |
|-------|----------|------|
| `type` | yes | One of: `log`, `metric`, `span` |
| `timestamp` | yes | Valid ISO 8601, not more than 24h in the future |
| `service` | yes | 1–256 chars, alphanumeric + hyphens/underscores |
| `environment` | yes | One of: `development`, `staging`, `production` |
| `attributes` | yes | Object, max 64KB serialized |
| `traceId` | no | 32 lowercase hex chars |
| `spanId` | no | 16 lowercase hex chars |

### Log Events

| Attribute | Required | Rule |
|-----------|----------|------|
| `level` | yes | One of: `debug`, `info`, `warn`, `error` |
| `message` | yes | 1–4096 chars |

### Metric Events

| Attribute | Required | Rule |
|-----------|----------|------|
| `metricType` | yes | One of: `counter`, `gauge`, `histogram`, `summary` |
| `name` | yes | 1–256 chars, regex: `^[a-zA-Z][a-zA-Z0-9_.-]*$` |
| `value` | yes | Finite number |

### Span Events

| Attribute | Required | Rule |
|-----------|----------|------|
| `spanName` | yes | 1–256 chars |
| `status` | no | `{ code: 0 \| 1 \| 2, message?: string }` |
| `events` | no | Array of `{ name: string, timestamp: string, attributes?: object }` |
| `links` | no | Array of `{ traceId: string, spanId: string }` |

---

## Error Responses

### 400 Bad Request — Validation Failed

```json
{
  "error": "validation_failed",
  "message": "Invalid telemetry event",
  "details": [
    {
      "path": "events[0].attributes.level",
      "message": "Must be one of: debug, info, warn, error"
    }
  ]
}
```

### 401 Unauthorized — Invalid API Key

```json
{
  "error": "unauthorized",
  "message": "Invalid or missing API key"
}
```

### 413 Payload Too Large

```json
{
  "error": "payload_too_large",
  "message": "Batch payload exceeds 512KB limit"
}
```

### 422 Unprocessable Entity — Schema Mismatch

```json
{
  "error": "schema_mismatch",
  "message": "Event type 'trace' is not supported. Use 'span' instead."
}
```

### 429 Too Many Requests — Rate Limited

```json
{
  "error": "rate_limited",
  "message": "Rate limit exceeded",
  "retryAfter": 5
}
```

Response headers:
```
Retry-After: 5
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705312200
```

### 500 Internal Server Error

```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limiting

Rate limits are enforced per API key and per organization.

| Scope | Limit | Window | Burst |
|-------|-------|--------|-------|
| Per API key | 1,000 requests | 1 minute | 100 requests/sec |
| Per organization | 10,000 requests | 1 minute | 500 requests/sec |

Rate limiting is implemented with Redis sliding window counters. When the limit is hit, the response includes `Retry-After` and `X-RateLimit-*` headers.

---

## Batch Ingestion

The SDK automatically batches events before sending. The server accepts both single-event and multi-event payloads.

### Limits

| Constraint | Value |
|------------|-------|
| Max events per batch | 100 |
| Max payload size | 512KB |
| Max events per second (per key) | 1,000 |

### Behavior

- Partial success: if some events in a batch fail validation, valid events are still accepted and invalid events are reported in the response.
- Partial response:

```json
HTTP/1.1 207 Multi-Status

{
  "accepted": 98,
  "rejected": 2,
  "errors": [
    { "index": 3, "error": "validation_failed", "message": "Missing required field 'level'" },
    { "index": 7, "error": "validation_failed", "message": "Invalid timestamp" }
  ]
}
```

---

## NATS Publishing

After validation, events are published to NATS JetStream.

### Topic Structure

```
telemetry.raw.{org_id}.{project_id}
```

### Message Format

```typescript
interface NatsTelemetryMessage {
  id: string;              // UUID, idempotency key (batchId + index)
  timestamp: Date;
  org_id: string;
  project_id: string;
  payload: {
    type: "log" | "metric" | "span";
    data: Record<string, any>;
    attributes: Record<string, any>;
    resource: {
      service: string;
      environment: string;
    };
  };
  metadata: {
    sdkVersion: string;
    batchId: string;
  };
}
```

---

## Idempotency

The `batchId` field in the request metadata serves as the idempotency key. The server stores `batchId` values for 24 hours. Duplicate submissions with the same `batchId` return the original response without re-processing.

```json
// First request
POST /api/v1/telemetry/ingest
{ "events": [...], "metadata": { "batchId": "b-abc123", ... } }
→ 202 Accepted, { "accepted": 5, "batchId": "b-abc123" }

// Duplicate request (same batchId)
POST /api/v1/telemetry/ingest
{ "events": [...], "metadata": { "batchId": "b-abc123", ... } }
→ 202 Accepted, { "accepted": 5, "batchId": "b-abc123", "duplicate": true }
```

---

## SDK vs Direct API

| Feature | SDK (`@soonwhy/sdk`) | Direct API |
|---------|----------------------|------------|
| Authentication | API key (auto-managed) | API key (manual) |
| Batching | Automatic (configurable) | Manual (client responsibility) |
| Retries | Exponential backoff (auto) | Client responsibility |
| PII filtering | Built-in (auto-redact) | Client responsibility |
| Context propagation | W3C Trace Context (auto) | Client responsibility |
| Fail-open | Events dropped on failure | Client handles errors |
| Payload limits | 64KB per event, 512KB per batch | Same |
| Rate limiting | Same limits, SDK handles 429 | Same limits, client handles 429 |

The SDK is recommended for application instrumentation. Direct API use is supported for custom telemetry pipelines, data migration, or non-Node.js runtimes.

---

## SDK Implementation Notes

The SDK sends to the single `POST /api/v1/telemetry/ingest` endpoint using the batch format. The `BatchPayload.events` array contains one or more `TelemetryEvent` objects. The SDK handles:

- Buffering events in memory
- Flushing on batch size, interval, or payload size threshold
- Retrying on 5xx and 429 responses with exponential backoff
- Circuit breaker after consecutive failures
- Graceful shutdown with final flush

See [SDK Design](./sdk.md) for full SDK specification.
