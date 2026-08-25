# Soonwhy — Data Flow Diagram

## Overview

This document shows the end-to-end data flow from SDK telemetry submission to dashboard visualization. All flows use NATS JetStream for async communication between services.

## Flow 1: Telemetry Ingestion

```
┌─────────┐     ┌─────────┐     ┌──────────────┐     ┌─────────┐     ┌──────────────┐
│   SDK   │────▶│   API   │────▶│  Ingestion   │────▶│  NATS   │────▶│  Processor   │
│         │     │ Service │     │   Worker     │     │ JetStream│     │   Worker     │
└─────────┘     └─────────┘     └──────────────┘     └─────────┘     └──────────────┘
     │                                                         │              │
     │                                                         │              ▼
     │                                                         │     ┌──────────────┐
     │                                                         │     │  ClickHouse  │
     │                                                         │     │  (Hot Store) │
     │                                                         │     └──────────────┘
     │                                                         │              │
     │                                                         │              ▼
     │                                                         │     ┌──────────────┐
     │                                                         └────▶│  R2 + Parquet│
     │                                                               │  (Cold Store)│
     │                                                               └──────────────┘
     │
     └──────────────────────────────────────────────────────────────────────────────────
```

### Detailed Steps

**Step 1: SDK → API**
```
SDK sends HTTP POST to /api/v1/telemetry/ingest
├── Request body: TelemetryEvent[]
├── Headers: Authorization: Bearer <api_key>
└── Response: { accepted: number, rejected: number }
```

**Step 2: API → Ingestion Worker**
```
API validates request:
├── API key → org_id, project_id, environment_id
├── Rate limiting (per API key)
├── Schema validation (Zod)
└── Publishes to NATS: telemetry.raw.{org_id}.{project_id}
```

**Step 3: Ingestion Worker → NATS**
```
Ingestion Worker:
├── Receives HTTP request
├── Enriches with org/project/environment metadata
├── Publishes to NATS JetStream topic
├── Returns acknowledgment to SDK
└── Handles backpressure (drops events if queue full)
```

**Step 4: NATS → Processor Worker**
```
Processor Worker subscribes to NATS:
├── telemetry.raw.{org_id}.{project_id}
├── Normalizes telemetry (standardize fields)
├── Parses timestamps (UTC)
├── Validates schema
└── Publishes to internal topic
```

**Step 5: Processor Worker → ClickHouse**
```
Processor Worker writes to ClickHouse:
├── Logs → logs table
├── Metrics → metrics table
├── Traces → traces table
├── Spans → spans table
├── Requests → requests table
└── Errors → errors table
```

**Step 6: Processor Worker → R2**
```
Processor Worker archives to R2:
├── Converts to Parquet format
├── Writes to s3://soonwhy-cold/{org_id}/{project_id}/{date}/
├── Updates lifecycle metadata
└── ClickHouse → R2 migration (after 7 days)
```

---

## Flow 2: Telemetry Query

```
┌──────────────┐     ┌─────────┐     ┌──────────────┐     ┌─────────┐
│  Dashboard   │────▶│   API   │────▶│  ClickHouse  │────▶│ Response│
│  (Frontend)  │     │ Service │     │  (Hot Store) │     │  Data   │
└──────────────┘     └─────────┘     └──────────────┘     └─────────┘
```

### Detailed Steps

**Step 1: Dashboard → API**
```
Dashboard sends HTTP GET to /api/v1/telemetry/query
├── Query params: project_id, time_range, filters
├── Headers: Authorization: Bearer <session_token>
└── Response: TelemetryQueryResult
```

**Step 2: API → ClickHouse**
```
API validates request:
├── Session token → org_id, project_id
├── Permission check (read access)
├── Builds ClickHouse query
└── Executes query with pagination
```

**Step 3: ClickHouse → Response**
```
ClickHouse returns results:
├── Executes analytical query
├── Returns paginated results
├── Includes metadata (total count, query time)
└── API formats response for frontend
```

---

## Flow 3: Cold Storage Migration

```
┌──────────────┐     ┌──────────┐     ┌──────────────┐
│   Scheduler  │────▶│ Processor│────▶│  R2 + Parquet│
│    Service   │     │  Worker  │     │  (Cold Store)│
└──────────────┘     └──────────┘     └──────────────┘
       │                    │                    │
       │                    ▼                    │
       │           ┌──────────────┐             │
       └──────────▶│  ClickHouse  │             │
                   │  (Hot Store) │             │
                   └──────────────┘             │
                                                │
                   ┌──────────────┐             │
                   │  R2 + Parquet│◀────────────┘
                   │  (Cold Store)│
                   └──────────────┘
```

### Detailed Steps

**Step 1: Scheduler → Processor Worker**
```
Scheduler triggers migration (every 5 minutes):
├── Queries ClickHouse for data > 7 days old
├── Groups by org_id, project_id, date
└── Publishes migration tasks to NATS
```

**Step 2: Processor Worker → ClickHouse**
```
Processor Worker reads old data:
├── SELECT * FROM {table} WHERE timestamp < NOW() - INTERVAL 7 DAY
├── Converts to Parquet format
└── Writes to R2
```

**Step 3: Processor Worker → R2**
```
Processor Worker writes to R2:
├── s3://soonwhy-cold/{org_id}/{project_id}/{date}/{table}.parquet
├── Updates metadata (file size, row count)
└── Verifies upload integrity
```

**Step 4: Processor Worker → ClickHouse**
```
Processor Worker deletes old data:
├── ALTER TABLE {table} DELETE WHERE timestamp < NOW() - INTERVAL 7 DAY
├── OPTIMIZE TABLE {table} FINAL
└── Updates lifecycle metadata
```

---

## Flow 4: AI Analysis

```
┌──────────────┐     ┌─────────┐     ┌──────────────┐     ┌─────────┐
│  Dashboard   │────▶│   API   │────▶│   AI Worker  │────▶│   LLM   │
│  (Frontend)  │     │ Service │     │              │     │ Provider│
└──────────────┘     └─────────┘     └──────────────┘     └─────────┘
                          │                  │                  │
                          │                  ▼                  │
                          │         ┌──────────────┐           │
                          │         │  ClickHouse  │           │
                          │         │  (Evidence)  │◀──────────┘
                          │         └──────────────┘
                          │                  │
                          ▼                  ▼
                     ┌──────────────────────────┐
                     │     PostgreSQL           │
                     │  (Analysis Results)      │
                     └──────────────────────────┘
```

### Detailed Steps

**Step 1: Dashboard → API**
```
Dashboard sends HTTP POST to /api/v1/ai/analysis
├── Request body: { analysis_type, time_range, signals }
├── Headers: Authorization: Bearer <session_token>
└── Response: { analysis_id, status: 'pending' }
```

**Step 2: API → AI Worker**
```
API publishes analysis request:
├── NATS topic: ai.analysis.request.{org_id}
├── Payload: { analysis_type, time_range, signals, context }
└── Returns analysis_id to dashboard
```

**Step 3: AI Worker → ClickHouse**
```
AI Worker queries evidence:
├── Queries relevant telemetry data
├── Correlates signals across logs, metrics, traces
├── Extracts evidence (specific data points)
└── Prepares context for LLM
```

**Step 4: AI Worker → LLM Provider**
```
AI Worker calls LLM:
├── Sends evidence + context to LLM
├── Receives analysis with confidence score
├── Validates response format
└── Stores result
```

**Step 5: AI Worker → PostgreSQL**
```
AI Worker stores results:
├── analysis_results table
├── Includes: analysis_id, org_id, result, confidence, evidence
└── Caches in Redis for fast retrieval
```

**Step 6: API → Dashboard**
```
API returns analysis:
├── Dashboard polls for results (or WebSocket)
├── Returns analysis with evidence
└── Dashboard renders AI insights
```

---

## Flow 5: Notifications

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Scheduler  │────▶│ Notifications│────▶│   Provider   │
│    Service   │     │   Service    │     │ (Email/Slack)│
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │                    ▼
       │           ┌──────────────┐
       │           │  PostgreSQL  │
       │           │  (Prefs)     │
       │           └──────────────┘
       │
       ▼
  ┌──────────────┐
  │   NATS       │
  │ JetStream    │
  └──────────────┘
```

### Detailed Steps

**Step 1: Scheduler → NATS**
```
Scheduler triggers alerts:
├── Checks usage thresholds (50%, 80%, 100%)
├── Checks billing events (invoice due, payment failed)
├── Checks system events (service down, errors spike)
└── Publishes to NATS: notifications.{type}.{org_id}
```

**Step 2: NATS → Notifications Service**
```
Notifications Service receives event:
├── Subscribes to notifications.*.* topics
├── Loads notification preferences from PostgreSQL
├── Determines delivery channels (email, Slack, Discord, webhook)
└── Formats message
```

**Step 3: Notifications Service → Provider**
```
Notifications Service sends notification:
├── Email: SendGrid/Resend API
├── Slack: Webhook URL
├── Discord: Webhook URL
├── Custom: Webhook URL
└── Handles delivery failures and retries
```

---

## Flow 6: Billing & Usage

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   API        │────▶│   Billing    │────▶│   Stripe     │
│   Service    │     │   Service    │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │                    ▼
       │           ┌──────────────┐
       │           │   Redis      │
       │           │  (Counters)  │
       │           └──────────────┘
       │
       ▼
  ┌──────────────┐
  │   ClickHouse │
  │  (Usage)     │
  └──────────────┘
```

### Detailed Steps

**Step 1: API → Billing Service**
```
API tracks usage:
├── Increment Redis counters (real-time)
├── Flush to ClickHouse (hourly)
├── Query usage stats for dashboard
└── Generate invoices (monthly)
```

**Step 2: Billing Service → Stripe**
```
Billing Service processes payments:
├── Create Stripe customer (on signup)
├── Generate invoice (monthly)
├── Process payment (automatic)
└── Handle dunning (failed payments)
```

**Step 3: Billing Service → Redis**
```
Billing Service tracks counters:
├── Ingestion volume (GB)
├── Storage volume (GB)
├── AI analyses (count)
├── API requests (count)
└── Real-time cost calculation
```

---

## NATS JetStream Topics

### Topic Hierarchy

```
telemetry
├── raw
│   └── {org_id}
│       └── {project_id}
├── processed
│   └── {org_id}
│       └── {project_id}
└── archived
    └── {org_id}
        └── {project_id}

ai
├── analysis
│   ├── request
│   │   └── {org_id}
│   └── result
│       └── {org_id}
└── evidence
    └── {org_id}
        └── {analysis_id}

notifications
├── alert
│   └── {org_id}
├── billing
│   └── {org_id}
└── usage
    └── {org_id}

scheduler
├── tasks
│   └── {task_type}
└── retries
    └── {task_type}
```

### Message Format

```typescript
// NATS message envelope
interface NatsMessage {
  id: string;           // UUID, idempotency key
  timestamp: Date;      // Message time
  org_id: string;       // Organization ID
  project_id?: string;  // Project ID (optional)
  payload: any;         // Message-specific payload
  metadata?: Record<string, any>; // Additional context
}

// Telemetry raw message
interface TelemetryRawMessage extends NatsMessage {
  payload: {
    type: 'log' | 'metric' | 'trace' | 'span' | 'request' | 'error';
    data: any;
    attributes: Record<string, any>;
    resource: Record<string, any>;
  };
}

// AI analysis request
interface AiAnalysisRequestMessage extends NatsMessage {
  payload: {
    analysis_type: 'anomaly' | 'root_cause' | 'correlation';
    time_range: { start: Date; end: Date };
    signals: string[];
    context?: string;
  };
}

// Notification message
interface NotificationMessage extends NatsMessage {
  payload: {
    type: 'alert' | 'billing' | 'usage';
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    action_url?: string;
  };
}
```

---

## Data Retention

### Hot Storage (ClickHouse)

| Data Type | Retention | Query Performance |
|-----------|-----------|-------------------|
| Logs | 7 days | Fast (ms) |
| Metrics | 7 days | Fast (ms) |
| Traces | 7 days | Fast (ms) |
| Spans | 7 days | Fast (ms) |
| Requests | 7 days | Fast (ms) |
| Errors | 7 days | Fast (ms) |

### Cold Storage (R2 + Parquet)

| Data Type | Retention | Query Performance |
|-----------|-----------|-------------------|
| Logs | 90 days | Medium (seconds) |
| Metrics | 90 days | Medium (seconds) |
| Traces | 90 days | Medium (seconds) |
| Spans | 90 days | Medium (seconds) |
| Requests | 90 days | Medium (seconds) |
| Errors | 90 days | Medium (seconds) |

### Archive Storage (R2 + Parquet)

| Data Type | Retention | Query Performance |
|-----------|-----------|-------------------|
| All | 365 days | Slow (minutes) |

---

## Performance Targets

| Flow | Latency Target | Throughput Target |
|------|----------------|-------------------|
| **Ingestion** | < 100ms (P95) | 10K events/sec |
| **Query** | < 200ms (P95) | 100 req/sec |
| **Cold Migration** | < 5 min (hourly batch) | 1GB/min |
| **AI Analysis** | < 30s (P95) | 10 req/sec |
| **Notifications** | < 5s (P95) | 1K notifications/sec |
| **Billing** | < 1s (P95) | 100 req/sec |
