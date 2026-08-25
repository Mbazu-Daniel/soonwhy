# Soonwhy — Error Handling

## Overview

This document defines how errors are structured, propagated, logged, and surfaced across the Soonwhy backend. The goal: predictable error behavior for both API consumers and internal systems.

---

## Error Types

Three layers, each with distinct responsibilities.

### Domain Errors

Business rule violations. These originate from domain logic and represent something the caller did wrong or a constraint the system enforces.

| Error | HTTP Status | When |
|-------|-------------|------|
| `ValidationError` | 400 / 422 | Request body failed validation, malformed input |
| `AuthError` | 401 | Missing or invalid credentials |
| `ForbiddenError` | 403 | Authenticated but insufficient permissions |
| `NotFoundError` | 404 | Resource does not exist |
| `ConflictError` | 409 | Duplicate creation, version mismatch, idempotency key collision |
| `RateLimitError` | 429 | Too many requests |

### Application Errors

Internal processing failures. These indicate something broke in the application layer — a database query failed, a message couldn't be published, an external service timed out.

| Error | HTTP Status | When |
|-------|-------------|------|
| `ExternalServiceError` | 502 / 503 | Upstream dependency unavailable |
| `TimeoutError` | 504 | Operation exceeded time limit |
| `ConfigurationError` | 500 | Missing or invalid server configuration |

### Infrastructure Errors

System-level failures. These are unexpected and should never be thrown explicitly — they bubble up from unhandled exceptions.

| Error | HTTP Status | When |
|-------|-------------|------|
| `InternalError` | 500 | Unexpected server error |

---

## Error Hierarchy

```
AppError (abstract base)
├── DomainError
│   ├── ValidationError
│   ├── AuthError
│   ├── ForbiddenError
│   ├── NotFoundError
│   ├── ConflictError
│   └── RateLimitError
├── ApplicationError
│   ├── ExternalServiceError
│   ├── TimeoutError
│   └── ConfigurationError
└── InternalError
```

### Base Class: `AppError`

```typescript
abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly type: string;        // RFC 7807 type URI
  abstract readonly title: string;       // Human-readable summary
  readonly isRetryable: boolean = false;

  constructor(
    message: string,
    readonly detail?: string,
    readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON() {
    return {
      type: `https://docs.soonwhy.dev/errors/${this.type}`,
      title: this.title,
      status: this.statusCode,
      detail: this.detail ?? this.message,
    };
  }
}
```

All custom errors extend `AppError`. Never throw raw `Error` instances in business logic.

---

## Error Response Format

All API errors follow [RFC 7807 (Problem Details for HTTP APIs)](https://datatracker.ietf.org/doc/html/rfc7807). See [api-conventions.md](../architecture/api-conventions.md) for the full spec.

```json
{
  "type": "https://docs.soonwhy.dev/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "Request body failed validation",
  "instance": "/api/v1/projects",
  "requestId": "req_abc123def456",
  "errors": [
    {
      "field": "attributes.name",
      "code": "REQUIRED",
      "message": "Name is required"
    }
  ]
}
```

### Required Fields

| Field | Description |
|-------|-------------|
| `type` | URI reference identifying the error type |
| `title` | Short human-readable summary |
| `status` | HTTP status code |
| `detail` | Human-readable explanation specific to this occurrence |
| `instance` | URI reference identifying the specific occurrence |
| `requestId` | Unique request identifier for correlation |
| `errors` | Array of field-level validation errors (for 400/422 only) |

### Field-Level Errors

For validation errors, include an `errors` array with:

| Field | Description |
|-------|-------------|
| `field` | Dot-notation path to the invalid field |
| `code` | Machine-readable error code (`REQUIRED`, `INVALID_ENUM`, `TOO_SHORT`) |
| `message` | Human-readable description of what's wrong |

---

## Error Propagation

The flow: throw in business logic → catch in controller → format response → log.

```
Controller (catch) → Format RFC 7807 response → Log with context
    ↑
Service (throw AppError) → Domain logic validates, enforces constraints
    ↑
Repository / External call → Infrastructure errors wrapped in AppError
```

### Rules

1. **Throw at the business logic layer.** Services and domain objects throw `AppError` subclasses. Never throw raw `Error`.
2. **Catch in the controller.** NestJS exception filters or Express/Fastify error middleware catch all `AppError` instances and format the RFC 7807 response.
3. **Wrap infrastructure errors.** Database drivers, HTTP clients, and message queues throw low-level errors. Wrap them in the appropriate `AppError` subclass before propagating.
4. **Never let raw errors leak.** Unhandled errors become `InternalError` (500). Stack traces are logged but never returned to the client.

### Context Enrichment

Every error must carry enough context for debugging:

- **`requestId`** — from `X-Request-ID` header or server-generated
- **`userId`** — from authenticated session (if available)
- **`orgId`** — from API key scope (if available)
- **`cause`** — original error for chaining (logged, not exposed)

---

## User-Facing vs Internal Errors

### User-Facing Errors

Returned in API responses. Include enough detail for the caller to fix the issue, but nothing that exposes internals.

```json
{
  "type": "https://docs.soonwhy.dev/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "Request body failed validation",
  "instance": "/api/v1/projects",
  "requestId": "req_abc123",
  "errors": [
    { "field": "attributes.name", "code": "REQUIRED", "message": "Name is required" }
  ]
}
```

**What's safe to expose:**
- Field-level validation errors
- Human-readable `detail` explaining what went wrong
- Request ID for support correlation
- Error type URI for documentation

**What's never exposed:**
- Stack traces
- Internal service names or IPs
- Database query details
- Configuration values
- Full exception messages from dependencies

### Internal Errors

Logged with full context for debugging. Never returned to the client.

```json
{
  "type": "https://docs.soonwhy.dev/errors/internal-error",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred",
  "instance": "/api/v1/projects",
  "requestId": "req_abc123"
}
```

The actual error details are logged server-side at `error` level with full context.

---

## Error Logging

All errors are logged with structured context. Use a consistent format.

### Log Entry Structure

```json
{
  "level": "error",
  "message": "Failed to process telemetry batch",
  "error": {
    "name": "ExternalServiceError",
    "message": "Connection refused to clickhouse://analytics:9000",
    "stack": "...",
    "cause": {
      "name": "Error",
      "message": "connect ECONNREFUSED 10.0.1.50:9000"
    }
  },
  "context": {
    "requestId": "req_abc123",
    "userId": "usr_def456",
    "orgId": "org_ghi789",
    "service": "ingestion-worker",
    "operation": "processBatch",
    "batchId": "batch_xyz"
  },
  "timestamp": "2026-08-25T10:30:00Z"
}
```

### Logging Rules

| Rule | Description |
|------|-------------|
| **Log once** | Don't log the same error at multiple layers. Log at the boundary where it's caught. |
| **Log with context** | Always include `requestId`, `userId` (if available), `orgId` (if available). |
| **Use appropriate level** | `error` for failures, `warn` for recoverable issues, `info` for business events. |
| **Redact sensitive data** | Never log API keys, passwords, tokens, or PII. |
| **Include cause chain** | Log the full error chain for `ExternalServiceError` and wrapped errors. |

### Log Levels by Error Type

| Error | Level | Rationale |
|-------|-------|-----------|
| `ValidationError` | `warn` | Client error, expected behavior |
| `AuthError` | `warn` | Client error, expected behavior |
| `ForbiddenError` | `warn` | Client error, expected behavior |
| `NotFoundError` | `info` | Normal absence, not exceptional |
| `ConflictError` | `warn` | Client error, expected behavior |
| `RateLimitError` | `info` | Expected under load |
| `ExternalServiceError` | `error` | Infrastructure failure |
| `TimeoutError` | `error` | Infrastructure failure |
| `ConfigurationError` | `error` | Server misconfiguration |
| `InternalError` | `error` | Unexpected failure |

---

## Retry Policies

### Retryable Errors

| Error | Retryable | Strategy |
|-------|-----------|----------|
| `ValidationError` | No | Client must fix input |
| `AuthError` | No | Client must fix credentials |
| `ForbiddenError` | No | Permissions won't change mid-request |
| `NotFoundError` | No | Resource doesn't exist |
| `ConflictError` | No | Conflict requires client resolution |
| `RateLimitError` | Yes | Retry after `Retry-After` header |
| `ExternalServiceError` | Yes | Exponential backoff |
| `TimeoutError` | Yes | Exponential backoff |
| `ConfigurationError` | No | Requires operator intervention |
| `InternalError` | Maybe | Case-by-case; usually no |

### Exponential Backoff

For retryable errors, use exponential backoff with jitter:

```
Attempt 1: 1000ms + random(0, 500)ms
Attempt 2: 2000ms + random(0, 1000)ms
Attempt 3: 4000ms + random(0, 2000)ms
Max delay: 30000ms
```

### SDK Retry Behavior

The SDK (`@soonwhy/sdk`) applies its own retry logic for ingestion:

- **4xx (except 429):** No retry
- **429:** Retry after `Retry-After` header
- **5xx:** Retry with exponential backoff
- **Network errors:** Retry with exponential backoff
- **Timeout:** Retry with exponential backoff
- **Max retries:** Configurable (default: 3)

---

## Circuit Breaker

The SDK implements a circuit breaker to avoid hammering a failing ingestion endpoint.

### States

```
CLOSED → (maxRetries consecutive failures) → OPEN
  ↑                                              │
  │                                     (60s health check)
  │                                              ↓
  └──────────────────── (health check passes) ──── HALF-OPEN
                                                       │
                                            (next request succeeds)
                                                       │
                                                       ↓
                                                    CLOSED
```

### Behavior

| State | Behavior |
|-------|----------|
| **CLOSED** | Normal operation. Requests pass through. |
| **OPEN** | Requests fail immediately. Health check every 60s. |
| **HALF-OPEN** | One test request allowed through. If it succeeds → CLOSED. If it fails → OPEN. |

### Buffer Overflow

When the circuit is open, events accumulate locally. If the buffer exceeds 10,000 events, new events are dropped and a warning is logged.

---

## Graceful Degradation

### SDK: Fail-Open

The SDK never crashes the application. All failures are caught and swallowed.

```typescript
try {
  sw.log("info", "event");
} catch {
  // Swallowed — app continues
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

| Scenario | Behavior |
|----------|----------|
| Ingestion down | Events buffered, retried, then dropped after max retries |
| Invalid API key | Events dropped, warning logged once |
| Network timeout | Retry with backoff, then drop |
| Buffer overflow | New events dropped, warning logged |
| Shutdown fails | Process exits normally |
| Auto-instrumentation fails | Other instruments continue, warning logged |

### Backend: Partial Failures

For batch operations (e.g., bulk ingestion), partial failures are handled per-item:

```json
{
  "data": [...],
  "errors": [
    {
      "index": 3,
      "code": "VALIDATION_ERROR",
      "message": "Missing required field: timestamp"
    }
  ],
  "meta": {
    "total": 10,
    "succeeded": 9,
    "failed": 1
  }
}
```

Successfully processed items are committed. Failed items are reported but don't block the batch.

### Dependency Failures

When a downstream dependency is unavailable:

1. **Read path:** Return cached data if available, otherwise fail with `503 Service Unavailable`.
2. **Write path:** Queue for retry, return `202 Accepted` with a status polling endpoint.
3. **Non-critical path:** Log the failure, continue with degraded functionality.

---

## Error Codes Reference

| Code | Type | HTTP Status | Retryable |
|------|------|-------------|-----------|
| `VALIDATION_ERROR` | `validation-error` | 400, 422 | No |
| `AUTHENTICATION_ERROR` | `authentication-error` | 401 | No |
| `AUTHORIZATION_ERROR` | `authorization-error` | 403 | No |
| `NOT_FOUND` | `not-found` | 404 | No |
| `CONFLICT` | `conflict` | 409 | No |
| `RATE_LIMIT_EXCEEDED` | `rate-limit-exceeded` | 429 | Yes |
| `EXTERNAL_SERVICE_ERROR` | `service-unavailable` | 502, 503 | Yes |
| `TIMEOUT` | `service-unavailable` | 504 | Yes |
| `INTERNAL_ERROR` | `internal-error` | 500 | No |
