# Soonwhy — Service Boundaries

## Overview

Soonwhy is a microservices architecture with 6 core services communicating via NATS JetStream. Each service has a single responsibility and clear boundaries.

## Service Inventory

### 1. API Service (NestJS)

**Purpose:** REST API for frontend, SDK, and external integrations.

**Responsibilities:**
- HTTP request handling (REST API)
- Authentication and authorization (Better Auth)
- Tenant resolution (org, project, environment)
- Rate limiting and throttling
- Request validation and transformation
- Response formatting

**Does NOT:**
- Process telemetry (delegates to Ingestion Worker)
- Store telemetry data (delegates to Processor Worker)
- Run AI analysis (delegates to AI Worker)
- Send notifications (delegates to Notifications Service)

**Technology:**
- NestJS (Node.js)
- Better Auth for authentication
- Drizzle ORM for PostgreSQL
- Zod for request validation

**Endpoints:**
```
POST   /api/v1/telemetry/ingest    # Submit telemetry
GET    /api/v1/telemetry/query     # Query telemetry
GET    /api/v1/projects            # List projects
POST   /api/v1/projects            # Create project
GET    /api/v1/organizations       # List organizations
POST   /api/v1/organizations       # Create organization
GET    /api/v1/ai/analysis         # Get AI analysis
POST   /api/v1/ai/analysis         # Request AI analysis
GET    /api/v1/billing/usage       # Get usage stats
GET    /api/v1/billing/invoices    # Get invoices
```

**Scaling:**
- Horizontal scaling (stateless)
- Load balanced behind nginx/HAProxy
- 2-4 instances for production

---

### 2. Ingestion Worker

**Purpose:** Receives telemetry from SDK, validates, and publishes to NATS.

**Responsibilities:**
- Receive telemetry via HTTP (from API) or direct SDK connection
- Validate telemetry schema
- Enrich with metadata (org, project, environment)
- Publish to NATS JetStream topics
- Handle backpressure (drop events when queue full)
- Rate limiting per API key

**Does NOT:**
- Store telemetry in ClickHouse (delegates to Processor Worker)
- Process or analyze telemetry (delegates to Processor/AI Worker)
- Handle authentication (delegates to API Service)
- Send responses to SDK (returns acknowledgment only)

**Technology:**
- NestJS (Node.js)
- NATS JetStream client
- Zod for schema validation
- Redis for rate limiting

**Input/Output:**
```
Input:  HTTP POST /ingest (telemetry events)
Output: NATS topic: telemetry.raw.{org_id}.{project_id}
```

**Scaling:**
- Horizontal scaling (stateless)
- 2-4 instances for production
- Partition by org_id for ordering

---

### 3. Processor Worker

**Purpose:** Normalizes, aggregates, and writes telemetry to ClickHouse.

**Responsibilities:**
- Subscribe to NATS JetStream topics
- Normalize telemetry (standardize fields, parse timestamps)
- Aggregate metrics (counters, gauges, histograms)
- Write to ClickHouse (hot storage)
- Archive to R2 + Parquet (cold storage)
- Handle ClickHouse schema migrations

**Does NOT:**
- Receive telemetry from SDK (delegates to Ingestion Worker)
- Run AI analysis (delegates to AI Worker)
- Handle authentication (delegates to API Service)
- Send notifications (delegates to Notifications Service)

**Technology:**
- NestJS (Node.js)
- NATS JetStream client
- ClickHouse client
- R2 client (Cloudflare)
- Parquet writer

**Input/Output:**
```
Input:  NATS topic: telemetry.raw.{org_id}.{project_id}
Output: ClickHouse tables (hot storage)
        R2 + Parquet files (cold storage)
```

**Scaling:**
- Horizontal scaling (stateless)
- 2-4 instances for production
- Partition by org_id for ordering

---

### 4. AI Worker

**Purpose:** Evidence extraction, LLM calls, and confidence scoring.

**Responsibilities:**
- Subscribe to NATS JetStream topics for analysis requests
- Extract evidence from telemetry (correlated signals)
- Call LLM providers (OpenAI, Anthropic, etc.)
- Score confidence (0-1) for AI conclusions
- Store analysis results in PostgreSQL
- Cache results in Redis

**Does NOT:**
- Receive telemetry from SDK (delegates to Ingestion Worker)
- Store raw telemetry (delegates to Processor Worker)
- Handle authentication (delegates to API Service)
- Send notifications (delegates to Notifications Service)

**Technology:**
- NestJS (Node.js)
- NATS JetStream client
- OpenAI/Anthropic SDKs
- Redis for caching
- PostgreSQL for analysis results

**Input/Output:**
```
Input:  NATS topic: ai.analysis.request.{org_id}
Output: NATS topic: ai.analysis.result.{org_id}
        PostgreSQL: analysis_results table
        Redis: cached results
```

**Scaling:**
- Horizontal scaling (stateless)
- 2-4 instances for production
- Partition by org_id for ordering
- Rate limit LLM calls (provider limits)

---

### 5. Scheduler Service

**Purpose:** Cron jobs, data migration, and cleanup tasks.

**Responsibilities:**
- Schedule recurring tasks (cron jobs)
- Migrate data from hot to cold storage
- Clean up expired data
- Generate usage reports
- Send billing alerts
- Retry failed operations

**Does NOT:**
- Process telemetry in real-time (delegates to Processor Worker)
- Handle API requests (delegates to API Service)
- Run AI analysis (delegates to AI Worker)
- Send notifications (delegates to Notifications Service)

**Technology:**
- NestJS (Node.js)
- @nestjs/schedule (cron)
- ClickHouse client
- R2 client

**Cron Jobs:**
```
*/5 * * * *  Check storage lifecycle (hot → cold migration)
0 * * * *    Generate hourly usage reports
0 0 * * *    Daily cleanup of expired data
0 0 1 * *    Monthly billing invoice generation
*/15 * * * *  Retry failed operations
```

**Scaling:**
- Single instance (leader election for cron)
- 1 instance for production
- Can scale to 2 for high availability

---

### 6. Notifications Service

**Purpose:** Email, Slack, Discord, and webhook notifications.

**Responsibilities:**
- Send email notifications (via SendGrid/Resend)
- Send Slack notifications (via webhook)
- Send Discord notifications (via webhook)
- Send custom webhooks
- Manage notification preferences
- Handle delivery failures and retries

**Does NOT:**
- Process telemetry (delegates to Processor Worker)
- Run AI analysis (delegates to AI Worker)
- Handle authentication (delegates to API Service)
- Store telemetry data (delegates to Processor Worker)

**Technology:**
- NestJS (Node.js)
- SendGrid/Resend SDK
- Slack webhook
- Discord webhook

**Input/Output:**
```
Input:  NATS topic: notifications.{type}.{org_id}
Output: Email (SendGrid/Resend)
        Slack webhook
        Discord webhook
        Custom webhooks
```

**Scaling:**
- Horizontal scaling (stateless)
- 1-2 instances for production
- Rate limit per provider

---

## Communication Patterns

### NATS JetStream Topics

```
# Telemetry flow
telemetry.raw.{org_id}.{project_id}           # Ingestion → Processor
telemetry.processed.{org_id}.{project_id}     # Processor → (future: real-time)

# AI analysis flow
ai.analysis.request.{org_id}                  # API → AI Worker
ai.analysis.result.{org_id}                   # AI Worker → API
ai.analysis.evidence.{org_id}.{analysis_id}   # AI Worker → (evidence storage)

# Notifications flow
notifications.alert.{org_id}                  # Scheduler → Notifications
notifications.billing.{org_id}                # Scheduler → Notifications
notifications.usage.{org_id}                  # Scheduler → Notifications

# System flow
scheduler.tasks.{task_type}                   # Scheduler → (internal)
scheduler.retries.{task_type}                 # Scheduler → (internal)
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
    data: any;          // Raw telemetry data
    attributes: Record<string, any>;
    resource: Record<string, any>;
  };
}

// AI analysis request message
interface AiAnalysisRequestMessage extends NatsMessage {
  payload: {
    analysis_type: 'anomaly' | 'root_cause' | 'correlation';
    time_range: { start: Date; end: Date };
    signals: string[];  // Which signals to analyze
    context?: string;   // Additional context
  };
}
```

### Communication Diagrams

**Telemetry Ingestion Flow**
```
SDK → API Service → Ingestion Worker → NATS → Processor Worker → ClickHouse
                                    ↓
                              R2 + Parquet (cold storage)
```

**AI Analysis Flow**
```
API Service → NATS → AI Worker → LLM Provider
                  ↓
            PostgreSQL (analysis results)
                  ↓
            NATS → API Service (response to frontend)
```

**Notification Flow**
```
Scheduler → NATS → Notifications Service → Email/Slack/Discord
```

---

## Service Dependencies

### External Dependencies

| Service | Dependencies |
|---------|--------------|
| **API** | PostgreSQL (auth, config), Redis (rate limiting) |
| **Ingestion Worker** | NATS JetStream, Redis (rate limiting) |
| **Processor Worker** | NATS JetStream, ClickHouse, R2 |
| **AI Worker** | NATS JetStream, PostgreSQL, Redis, LLM providers |
| **Scheduler** | ClickHouse, R2, NATS JetStream |
| **Notifications** | NATS JetStream, SendGrid/Resend, Slack, Discord |

### Internal Dependencies

```
API Service
├── Ingestion Worker (publishes telemetry)
├── AI Worker (requests analysis)
└── Notifications Service (sends alerts)

Ingestion Worker
└── Processor Worker (via NATS)

Processor Worker
└── (none - leaf service)

AI Worker
└── Processor Worker (queries telemetry for evidence)

Scheduler
├── Processor Worker (triggers migration)
├── Notifications Service (sends alerts)
└── (none - leaf service)

Notifications Service
└── (none - leaf service)
```

---

## Data Ownership

| Service | Owns Data | Storage |
|---------|-----------|---------|
| **API** | Auth tokens, sessions, config | PostgreSQL |
| **Ingestion Worker** | Rate limit counters | Redis |
| **Processor Worker** | Raw telemetry, aggregated metrics | ClickHouse, R2 |
| **AI Worker** | Analysis results, evidence | PostgreSQL, Redis |
| **Scheduler** | Task schedules, job state | PostgreSQL |
| **Notifications** | Notification preferences, delivery status | PostgreSQL |

---

## Failure Modes

### Service Failures

| Service | Failure Impact | Recovery |
|---------|----------------|----------|
| **API** | All API requests fail | Restart, load balancer removes from pool |
| **Ingestion Worker** | Telemetry ingestion paused | SDK retries (exponential backoff) |
| **Processor Worker** | Telemetry not stored | NATS replays messages on restart |
| **AI Worker** | AI analysis unavailable | Graceful degradation (show cached results) |
| **Scheduler** | Cron jobs not running | Restart, missed jobs run immediately |
| **Notifications** | Alerts not sent | NATS replays messages on restart |

### NATS JetStream Config

```typescript
// JetStream configuration
const streamConfig = {
  name: 'telemetry',
  subjects: ['telemetry.raw.*.*'],
  retention: 'limits',
  max_age: 24 * 60 * 60 * 1000 * 7, // 7 days
  max_bytes: 1024 * 1024 * 1024 * 10, // 10GB
  storage: 'file',
  replicas: 3,
};
```

---

## Deployment

### Docker Compose (Single Host)

```yaml
services:
  api:
    image: soonwhy/api
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=postgresql://...
      - NATS_URL=nats://nats:4222
      - REDIS_URL=redis://redis:6379

  ingestion-worker:
    image: soonwhy/ingestion-worker
    environment:
      - NATS_URL=nats://nats:4222
      - REDIS_URL=redis://redis:6379

  processor-worker:
    image: soonwhy/processor-worker
    environment:
      - NATS_URL=nats://nats:4222
      - CLICKHOUSE_URL=http://clickhouse:8123
      - R2_ENDPOINT=...

  ai-worker:
    image: soonwhy/ai-worker
    environment:
      - NATS_URL=nats://nats:4222
      - DATABASE_URL=postgresql://...
      - OPENAI_API_KEY=...
      - ANTHROPIC_API_KEY=...

  scheduler:
    image: soonwhy/scheduler
    environment:
      - NATS_URL=nats://nats:4222
      - CLICKHOUSE_URL=http://clickhouse:8123

  notifications:
    image: soonwhy/notifications
    environment:
      - NATS_URL=nats://nats://nats:4222
      - SENDGRID_API_KEY=...

  nats:
    image: nats:2.10
    command: ["-js"]

  clickhouse:
    image: clickhouse/clickhouse-server:latest

  postgres:
    image: postgres:16

  redis:
    image: redis:7-alpine
```

### Kubernetes (Future)

- Deploy each service as separate Deployment
- Use NATS Operator for JetStream
- Use ClickHouse Operator for ClickHouse
- Use CloudNativePG for PostgreSQL
- Use Redis Operator for Redis
