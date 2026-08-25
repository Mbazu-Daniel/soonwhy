# Soonwhy — API Conventions

## Overview

All external-facing APIs follow these conventions. Internal service-to-service communication uses NATS JetStream (see [services.md](./services.md) and [data-flow.md](./data-flow.md)).

---

## Base URL and Versioning

```
https://api.soonwhy.dev/v1/{resource}
```

- **URL-based versioning:** `/v1/` prefix on all endpoints.
- Versions are bumped for breaking changes only (new required fields, removed endpoints, changed semantics).
- Deprecation: old versions get a `Sunset` header with a date at least 90 days out, plus a `Deprecation` header.

---

## URL Structure

```
/v1/{resource}                  # Collection (list, create)
/v1/{resource}/{id}             # Singleton (read, update, delete)
/v1/{resource}/{id}/{sub}       # Sub-resource
/v1/{resource}/{id}/{sub}/{sid} # Sub-resource singleton
```

- Use **plural nouns** for resources: `/v1/projects`, `/v1/organizations`, `/v1/telemetry/ingest`.
- Use **kebab-case** for multi-word resources: `/v1/ai/analysis`, `/v1/billing/invoices`.
- No verbs in URLs. Use HTTP methods to express intent.

---

## HTTP Methods

| Method | Use | Idempotent | Body |
|--------|-----|------------|------|
| `GET` | Read resource(s) | Yes | No |
| `POST` | Create resource, or trigger action | No | Yes |
| `PUT` | Full replace of resource | Yes | Yes |
| `PATCH` | Partial update of resource | No | Yes |
| `DELETE` | Remove resource | Yes | No |

`POST /ingest` is a special case — it accepts telemetry payloads and returns an acknowledgment, not a created resource.

---

## Status Codes

| Code | Meaning | When |
|------|---------|------|
| `200` | OK | Successful read or update |
| `201` | Created | Successful resource creation |
| `204` | No Content | Successful deletion |
| `400` | Bad Request | Validation error, malformed JSON |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Authenticated but insufficient permissions |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Duplicate creation (e.g., idempotency key collision) |
| `422` | Unprocessable Entity | Semantically invalid request |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server failure |
| `503` | Service Unavailable | Temporary overload or maintenance |

---

## Request Format

All request bodies must be JSON with `Content-Type: application/json`.

### Single Resource

```json
{
  "data": {
    "type": "projects",
    "attributes": {
      "name": "my-project",
      "environment": "production"
    }
  }
}
```

### Batch / Collection

```json
{
  "data": [
    {
      "type": "telemetry_events",
      "attributes": { ... }
    },
    {
      "type": "telemetry_events",
      "attributes": { ... }
    }
  ]
}
```

---

## Response Format

All responses wrap data in a top-level object. Successful responses include a `data` key. Errors use the RFC 7807 format below.

### Single Resource

```json
{
  "data": {
    "id": "proj_abc123",
    "type": "projects",
    "attributes": {
      "name": "my-project",
      "environment": "production"
    },
    "meta": {
      "created_at": "2026-08-25T10:30:00Z",
      "updated_at": "2026-08-25T10:30:00Z"
    }
  }
}
```

### Collection (with pagination)

```json
{
  "data": [
    { "id": "proj_abc123", "type": "projects", "attributes": { ... } },
    { "id": "proj_def456", "type": "projects", "attributes": { ... } }
  ],
  "meta": {
    "total": 42
  },
  "pagination": {
    "next_cursor": "eyJpZCI6InByb2pfZGVmNDU2In0=",
    "has_more": true
  }
}
```

---

## Pagination (Cursor-Based)

Cursor-based pagination is preferred over offset-based. Cursors are opaque, base64-encoded strings — do not parse or construct them on the client.

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page[size]` | `25` | Number of items per page (max `100`) |
| `page[after]` | — | Cursor pointing to the item after which to fetch |
| `page[before]` | — | Cursor pointing to the item before which to fetch |

### Example

```
GET /api/v1/projects?page[size]=10&page[after]=eyJpZCI6InByb2pfZGVmNDU2In0=
```

### Response

```json
{
  "data": [ ... ],
  "pagination": {
    "next_cursor": "eyJpZCI6InByb2pfZ2hpNzg5In0=",
    "previous_cursor": "eyJpZCI6InByb2pfY2RlMjM0In0=",
    "has_more": true
  }
}
```

When `has_more` is `false`, there are no more results in that direction.

---

## Filtering and Sorting

### Filtering

Use `filter[field]` query parameters. Multiple filters combine with AND logic.

```
GET /api/v1/telemetry/query?filter[level]=error&filter[service]=payment-api
```

Supported filter operators (append to field name):

| Operator | Example | Description |
|----------|---------|-------------|
| (exact) | `filter[level]=error` | Exact match |
| `_gt` | `filter[timestamp_gt]=2026-08-25T00:00:00Z` | Greater than |
| `_lt` | `filter[timestamp_lt]=2026-08-25T23:59:59Z` | Less than |
| `_gte` | `filter[count_gte]=10` | Greater than or equal |
| `_lte` | `filter[count_lte]=50` | Less than or equal |
| `_in` | `filter[level_in]=error,warn` | In a set of values |
| `_contains` | `filter[message_contains]=timeout` | Substring match |

### Sorting

Use the `sort` query parameter. Prefix with `-` for descending.

```
GET /api/v1/telemetry/query?sort=-timestamp
GET /api/v1/projects?sort=name
```

Multiple sort fields are supported, comma-separated:

```
GET /api/v1/telemetry/query?sort=-level,timestamp
```

---

## Error Response Format (RFC 7807)

All errors follow [RFC 7807 (Problem Details for HTTP APIs)](https://datatracker.ietf.org/doc/html/rfc7807).

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
    },
    {
      "field": "attributes.environment",
      "code": "INVALID_ENUM",
      "message": "Must be one of: development, staging, production"
    }
  ]
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | URI reference identifying the error type |
| `title` | Yes | Short human-readable summary |
| `status` | Yes | HTTP status code |
| `detail` | Yes | Human-readable explanation specific to this occurrence |
| `instance` | Yes | URI reference identifying the specific occurrence |
| `requestId` | Yes | Unique request identifier for correlation |
| `errors` | No | Array of field-level validation errors (for 400/422) |

### Error Types

| Type URI | Status | When |
|----------|--------|------|
| `validation-error` | 400, 422 | Request validation failed |
| `authentication-error` | 401 | Missing or invalid credentials |
| `authorization-error` | 403 | Insufficient permissions |
| `not-found` | 404 | Resource not found |
| `conflict` | 409 | Resource conflict (duplicate, version mismatch) |
| `rate-limit-exceeded` | 429 | Too many requests |
| `internal-error` | 500 | Unexpected server error |
| `service-unavailable` | 503 | Service temporarily unavailable |

---

## Rate Limiting

Rate limits are enforced per API key. The following headers are included in every response:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | UTC epoch timestamp when the window resets |
| `Retry-After` | Seconds until next request is allowed (only on 429) |

### Default Limits

| Tier | Requests/min | Burst |
|------|-------------|-------|
| Free | 60 | 10/sec |
| Pro | 600 | 50/sec |
| Enterprise | 6000 | 200/sec |

When the limit is exceeded, return `429 Too Many Requests` with the `Retry-After` header.

---

## Authentication

All requests must include an `Authorization` header.

### API Keys (SDK / Server-to-Server)

```
Authorization: Bearer sw_live_abc123def456
```

API keys are scoped to an organization and project. Prefix: `sw_live_` (production), `sw_test_` (sandbox).

### Session Tokens (Frontend / Browser)

```
Authorization: Bearer <session_token>
```

Session tokens are issued by Better Auth after login. They are short-lived JWTs with automatic refresh.

### Passing API Keys in URLs (SDK only)

For the ingestion endpoint, the SDK may pass the API key as a query parameter when custom headers are not possible (e.g., some browser environments):

```
POST /api/v1/telemetry/ingest?api_key=sw_live_abc123def456
```

This is discouraged for production use — prefer the `Authorization` header.

---

## Idempotency Keys

All mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) must include an idempotency key to prevent duplicate operations.

```
Idempotency-Key: idem_abc123def456
```

### Rules

- The key must be a unique string (UUID v4 recommended).
- The server stores the key and the result for **24 hours**.
- If a request is received with a previously used key, the server returns the **original response** (including status code) without re-executing the operation.
- If the original request is still processing, the server returns `409 Conflict` with a `Retry-After` header.
- Idempotency keys are scoped to the combination of API key + endpoint + method.

### Example

```
POST /api/v1/telemetry/ingest
Authorization: Bearer sw_live_abc123
Idempotency-Key: idem_550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{ "data": [ ... ] }
```

If the network drops and the client retries with the same `Idempotency-Key`, the server returns the original `200 OK` with the same response body.

---

## Request ID

Every request should include a client-generated request ID for tracing:

```
X-Request-ID: req_abc123def456
```

If not provided, the server generates one and includes it in the response. This ID is logged and included in error responses as `requestId`.

---

## Content Negotiation

| Header | Value | Description |
|--------|-------|-------------|
| `Content-Type` | `application/json` | Request and response bodies |
| `Accept` | `application/json` | Client expects JSON |

The API does not support XML, form-encoded, or other content types.

---

## Timezone

All timestamps must be in **ISO 8601 / RFC 3339** format with UTC timezone:

```
2026-08-25T10:30:00Z
```

Never use local time or offset notation (`+00:00` is acceptable but `Z` is preferred).

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Resource names | plural snake_case | `telemetry_events`, `analysis_results` |
| Field names | snake_case | `created_at`, `org_id` |
| Query parameters | dot notation | `page[size]`, `filter[level]` |
| Header names | Title-Case hyphenated | `X-RateLimit-Limit` |
| Error codes | UPPER_SNAKE_CASE | `VALIDATION_ERROR`, `NOT_FOUND` |

---

## API Reference

Full endpoint inventory is listed in [services.md](./services.md). The SDK communicates with these endpoints as described in [sdk.md](./sdk.md).
