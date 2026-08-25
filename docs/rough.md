I would break Soonwhy into 10 major phases.

The important thing is that these aren't just development sprints. Each phase should produce a usable artifact + working code + tests, so Codex always has a clear boundary.

Soonwhy — 10-Phase Build Plan
Phase	Name	Main Goal
0	Product Foundation	Lock the product and engineering specification
1	Platform Foundation	Monorepo, auth, tenancy, projects, environments
2	SDK & Ingestion	@soonwhy/sdk + telemetry pipeline
3	Mission Control	The first useful developer experience
4	Observability Core	Logs, metrics, traces, APIs
5	Developer Intelligence	Prisma, Redis, BullMQ, Cron
6	AI Intelligence	Root-cause analysis, summaries, recommendations
7	Incidents & Alerts	Detection, alerting, incident management
8	Production & Billing	Pricing, usage metering, security, scaling
9	Beta → GA	Hardening, integrations, enterprise, launch

But I'd actually treat Phase 0 as extremely important.

Phase 0 — Product Foundation

Goal: Create the complete Soonwhy artifact before serious implementation.

Product
PRD
Vision
Product principles
Personas
JTBD
Competitive research
Pricing
MVP definition
Roadmap
Success metrics
Architecture
System architecture
Multi-tenancy
Data architecture
API architecture
SDK architecture
AI architecture
Security architecture
Deployment architecture
Engineering
Monorepo structure
Coding standards
Git workflow
Testing strategy
Error handling
Observability strategy
ADRs
AI
ATLAS.md → eventually SOONWHY.md
AGENTS.md
CODEX.md
AI task format
AI implementation workflow

Exit condition:

An AI agent can understand what Soonwhy is and how it should be built without asking fundamental architectural questions.

Phase 1 — Platform Foundation

Now we actually code.

Soonwhy
│
├── Organization
├── Users
├── Projects
├── Environments
├── Services
└── API Keys

Build:

Turborepo
Next.js
NestJS
PostgreSQL
Drizzle
Redis
authentication
RBAC foundation
organizations
projects
environments
API keys
Exit condition

You can create:

Organization
    ↓
Project
    ↓
Production
    ↓
API Key
Phase 2 — SDK & Ingestion

This is the most important phase.

Build:

npm install @soonwhy/sdk

Then:

Soonwhy.init({
  apiKey: process.env.SOONWHY_API_KEY
});

Build:

SDK
batching
buffering
retry
fail-open behavior
API authentication
ingestion gateway
telemetry schema
event validation
queue/broker
ClickHouse

Initial telemetry:

logs
metrics
errors
requests
traces
Exit condition

A real Node/NestJS application sends telemetry and Soonwhy stores it.

Phase 3 — Mission Control

This is where Soonwhy becomes visible.

Build:

Dashboard
Mission Control

Health Score
AI Summary
Services
Errors
Latency
Recent Deployments
Active Issues
Recommendations

Plus:

service overview
basic charts
realtime updates
application health
Exit condition

A developer can install Soonwhy and immediately understand their application's current state.

Phase 4 — Observability Core

Now go deep.

Logs
ingestion
search
filtering
structured logs
context
Metrics
time series
aggregation
dashboards
Traces
distributed traces
spans
trace waterfall
service dependencies
APIs
endpoint performance
latency
error rates
status codes
Exit condition

Soonwhy becomes a legitimate observability platform.

Phase 5 — Developer Intelligence

This is where Soonwhy starts separating itself from generic observability tools.

Build:

Prisma

Detect:

slow queries
N+1
query frequency
regressions
missing indexes
Redis

Detect:

latency
memory
connections
errors
BullMQ

Detect:

backlog
failures
retries
throughput
worker health
Cron

Detect:

failures
missed executions
duration
schedule drift
Exit condition

Soonwhy understands the application internals, not just generic telemetry.

Phase 6 — AI Intelligence

Now we turn telemetry into intelligence.

Build:

AI Summary

"Your application is healthy, but payment latency increased 18%."

Root Cause Analysis
Deployment
 ↓
Database
 ↓
API
 ↓
Queue
AI Chat

Users ask:

Why is my API slow?

What changed today?

What's causing the queue backlog?

Recommendations
Problem

payments.user_id query is slow.

Recommendation

Add an index.

Expected impact

Potential 35–60% reduction in query latency.
Important

AI must have access to evidence.

No:

"I think Redis might be the problem."

Instead:

"Redis latency increased from 2ms → 84ms beginning at 14:32. This coincides with the API latency increase."

Exit condition

Soonwhy can explain problems rather than simply display them.

Phase 7 — Incidents & Alerts

Now build the operational layer.

Detection

Automatically detect:

anomalies
outages
regressions
queue failures
cron failures
Incidents
INC-1024

Payment degradation

Started:
14:32

Impact:
32%

Root cause:
Deployment #143
Alerts
email
Slack
Discord
webhooks
Exit condition

Soonwhy can detect and notify developers about important problems without requiring them to stare at the dashboard.

Phase 8 — Production & Billing

Now make it a real SaaS.

Billing
Starter
Growth
Enterprise

7-day trial.

Build:

Stripe
usage metering
telemetry limits
retention
invoices
subscription lifecycle
Security
RBAC
audit logs
API key rotation
encryption
tenant isolation
PII redaction
secret detection
Infrastructure
autoscaling
rate limiting
backpressure
data retention
backups
disaster recovery
Exit condition

You can safely charge real customers.

Phase 9 — Beta

Now give it to developers.

Don't immediately add 50 features.

Measure:

Most important metric

Time to Understanding (TTU)

How long from:

"Something is wrong."

to:

"I understand why."

Also measure:

onboarding completion
SDK installation success
telemetry reliability
AI usefulness
alert usefulness
trial conversion
retention
infrastructure cost
Phase 10 — General Availability

Now expand.

More SDKs
Node
Python
Go
Java
.NET
More infrastructure
Kafka
RabbitMQ
SQS
Kubernetes
Docker
More integrations
GitHub
GitLab
Vercel
Railway
AWS
GCP
Azure
Slack
PagerDuty
Enterprise
SSO
SCIM
advanced RBAC
audit
compliance
private deployment
data residency
SLA
The really important part

I wouldn't build all 10 phases simultaneously.

We should have a strict dependency chain:

                 SOONWHY

                    │
                    ▼
             Phase 0
        Product Foundation
                    │
                    ▼
             Phase 1
        Platform Foundation
                    │
                    ▼
             Phase 2
        SDK + Ingestion
                    │
                    ▼
             Phase 3
        Mission Control
                    │
                    ▼
             Phase 4
       Observability Core
                    │
                    ▼
             Phase 5
    Developer Intelligence
                    │
                    ▼
             Phase 6
        AI Intelligence
                    │
                    ▼
             Phase 7
       Incidents + Alerts
                    │
                    ▼
             Phase 8
      Billing + Production
                    │
                    ▼
             Phase 9
                Beta
                    │
                    ▼
             Phase 10
                 GA
And here's where I'd start right now

Phase 0.

Not code.

We create the Soonwhy Master Artifact containing:

SOONWHY.md
FOUNDER.md
PRD.md
PRODUCT-PRINCIPLES.md
ROADMAP.md

architecture/
database/
api/
sdk/
ai/
design-system/
security/
infrastructure/

tasks/
    phase-0/
    phase-1/
    phase-2/
    ...

Then Phase 0 itself gets broken into detailed tasks.

Once that artifact is complete, we can create the actual Git repository and start Phase 1 with Codex.

That prevents us from having the classic AI-development problem of:

"Build this feature."

→ AI builds it one way.

Then three weeks later:

"Build this other feature."

→ AI builds it completely differently.

The artifact becomes the contract that keeps the entire Soonwhy codebase coherent.

i am using golang gin, tanstack start, object storage instead f clickhuse , 
can you tell me all the things i will need 

Yes. And with your stack, I would change the architecture from what we discussed earlier.

You have:

Go + Gin for backend
TanStack Start for web
Object storage instead of ClickHouse
Redis
PostgreSQL
SDK-first ingestion
AI intelligence
Multi-tenancy
Logs/metrics/traces/API monitoring
Prisma/BullMQ/Redis/Cron intelligence
Billing
Alerts/incidents

The key question is: what exactly does object storage replace?

Object storage is excellent for cheap, durable telemetry storage, but it is not a database/query engine. So I would not simply replace ClickHouse with S3/R2 and query raw JSON forever. We need a storage/query architecture around it.

Soonwhy — Complete Technology & Infrastructure Map
                         SOONWHY
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
       WEB APP                            SDK / CLI
   TanStack Start                    Node / Python / Go
          │                                   │
          └─────────────────┬─────────────────┘
                            │
                            ▼
                    API / INGESTION
                       Go + Gin
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
           Redis        PostgreSQL    Object Storage
              │             │             │
              │             │             │
              └─────────────┼─────────────┘
                            │
                            ▼
                    Processing Workers
                          Go
                            │
                 ┌──────────┼──────────┐
                 ▼          ▼          ▼
              Logs       Metrics      Traces
                 │          │          │
                 └──────────┼──────────┘
                            ▼
                     Intelligence
                            │
                    ┌───────┴───────┐
                    ▼               ▼
                  Rules             AI
                    │               │
                    └───────┬───────┘
                            ▼
                       Mission Control

Now let's break down everything you need.

1. Frontend
TanStack Start

This is your main application.

I'd use:

TanStack Start
TanStack Router
TanStack Query
React
TypeScript
Tailwind
shadcn/ui
Responsibilities
Authentication UI
Mission Control
Logs
Metrics
Traces
APIs
Database
Redis
BullMQ
Cron
Incidents
Alerts
AI chat
Settings
Billing
2. Backend
Go + Gin

Your primary API.

Go
Gin

I would structure it roughly:

services/api/

├── cmd/
├── internal/
│
├── auth/
├── organizations/
├── projects/
├── environments/
├── services/
│
├── telemetry/
├── logs/
├── metrics/
├── traces/
│
├── incidents/
├── alerts/
├── deployments/
│
├── integrations/
├── ai/
├── billing/
│
└── storage/
3. PostgreSQL

Postgres should be the system of record for application metadata.

Store:

users
organizations
memberships
projects
environments
services
api_keys
integrations
alerts
incidents
deployments
billing
subscriptions
usage
AI conversations
AI insights

Don't store huge telemetry datasets here.

4. Object Storage

This is where your architecture becomes interesting.

Use something S3-compatible:

Cloudflare R2
AWS S3
MinIO
Backblaze B2

I would strongly consider Cloudflare R2 if you're already comfortable with Cloudflare.

Object storage handles:

raw logs
raw metrics
raw traces
archived telemetry
large payloads
exports
reports

Example:

telemetry/
    org_123/
        project_456/
            production/
                2026/
                    08/
                        15/
                            logs/
                            metrics/
                            traces/

But do not query thousands of JSON objects directly from your dashboard.

That's where another component is needed.

5. Telemetry Query Layer

This is the part people often overlook.

You need somewhere to perform:

WHERE
GROUP BY
COUNT
AVG
P95
P99
TIME WINDOW
FILTER
SEARCH

If you don't want ClickHouse, you have several options.

Option A — PostgreSQL + Timescale

Very reasonable for an MVP.

PostgreSQL
+
TimescaleDB

Use it for:

metrics
aggregates
time-series data

Object storage remains the archive.

Option B — DuckDB

Interesting for your architecture.

You could store telemetry in Parquet:

Object Storage
      ↓
Parquet
      ↓
DuckDB
      ↓
Query

This is extremely interesting for cost-efficient analytical workloads, but you'll need to carefully engineer concurrent production querying.

Option C — PostgreSQL + Parquet

For the initial MVP, I would seriously consider:

Postgres
    +
Object Storage
    +
Parquet

Hot data:

Postgres

Cold/archive data:

R2

Aggregated telemetry:

Parquet

This can keep infrastructure relatively simple.

6. Redis

Redis becomes extremely useful.

Use it for:

caching
rate limiting
sessions
API key validation
temporary telemetry buffers
realtime state
distributed locks
deduplication
job queues

But don't make Redis your permanent telemetry database.

7. Message Queue

You need asynchronous processing.

For example:

SDK
 ↓
Gin
 ↓
Queue
 ↓
Workers

You have several choices.

NATS

I'd seriously consider:

NATS JetStream

because it's lightweight and excellent for event-driven systems.

Or:

Kafka

More powerful but considerably more operational complexity.

For your MVP:

NATS JetStream

is attractive.

8. Go Workers

You need workers separate from the API.

services/

api/
ingestion/
processor/
ai/
scheduler/
notifications/

Workers process:

logs
metrics
traces
alerts
incidents
AI analysis
retention
aggregation
9. Telemetry Model

You need a canonical event format.

Something like:

type TelemetryEvent struct {
    ID            string
    OrganizationID string
    ProjectID      string
    EnvironmentID  string
    ServiceID      string

    Timestamp      time.Time
    Type           EventType

    TraceID        string
    SpanID         string

    Attributes     map[string]any
    Resource       map[string]any
}

Event types:

log
metric
trace
span
request
error
deployment
queue
cron
database
10. OpenTelemetry

I strongly recommend building around OpenTelemetry concepts.

You don't have to reinvent telemetry semantics.

Use OTel where practical for:

traces
spans
metrics
context propagation

Then Soonwhy adds its own intelligence layer.

This gives you compatibility with existing applications.

11. SDK

Your SDK becomes extremely important.

For Node:

@soonwhy/sdk

Packages could eventually be:

@soonwhy/sdk
@soonwhy/nestjs
@soonwhy/express
@soonwhy/fastify
@soonwhy/prisma
@soonwhy/bullmq
@soonwhy/redis
@soonwhy/cron

But I would not make developers install all of these manually.

Eventually:

npx soonwhy init

detects their application.

12. SDK Architecture

The SDK should have:

Core
│
├── Transport
├── Batching
├── Buffer
├── Retry
├── Sampling
├── Context
├── Instrumentation
│
├── HTTP
├── Database
├── Redis
├── Queue
└── Cron

Critical requirement:

Fail Open

If Soonwhy is down:

Application continues.

Never:

Soonwhy unavailable
→ application crashes
13. API Gateway

Your Gin service handles:

authentication
API keys
tenant resolution
rate limiting
validation
ingestion
dashboard API

I'd separate ingestion endpoints from dashboard APIs logically, even if they initially live in the same Go service.

Example:

/v1/ingest/*
/v1/projects/*
/v1/services/*
/v1/logs/*
/v1/metrics/*
/v1/traces/*
/v1/incidents/*
/v1/ai/*
14. Authentication

You need:

users
organizations
sessions
API keys
service keys
RBAC

Roles:

Owner
Admin
Member
Viewer

Enterprise eventually:

SSO
SCIM
SAML
OIDC
15. API Key Architecture

A project might have:

Production API Key
Staging API Key
Development API Key

Don't store raw API keys.

Store:

hash
prefix
created_at
last_used_at
revoked_at

The SDK gets the actual secret once.

16. Alert Engine

You need a rule engine.

Example:

IF

p95_latency > 500ms

FOR

5 minutes

THEN

create incident

More advanced:

IF

error_rate increases > 30%

AND

deployment occurred within 15 minutes

THEN

investigate deployment

This becomes the foundation of your AI system.

17. Incident Engine

Incident states:

Detected
Investigating
Identified
Mitigating
Resolved
Closed

Each incident gets a timeline:

14:21 Deployment
14:23 Latency increased
14:24 Error rate increased
14:25 Queue backlog increased
14:27 Incident created
14:30 Root cause identified
14:42 Resolved
18. AI Engine

You need a separate AI service/module.

I would not put all AI logic directly inside Gin handlers.

Architecture:

Telemetry
   ↓
Correlation
   ↓
Evidence
   ↓
Context Builder
   ↓
LLM
   ↓
Structured Result
   ↓
Insight

The important word is:

Evidence.

The AI should not receive random telemetry dumps.

It gets a curated context:

Recent deployment
Relevant traces
Relevant logs
Database anomalies
Queue anomalies
Metric changes
19. AI Models

Don't hard-code yourself to one model provider.

Create an abstraction:

AIProvider

├── OpenAI
├── Anthropic
├── Google
└── Local

You can change models later.

20. AI Output Schema

Force structured responses.

Something like:

{
  "summary": "...",
  "severity": "high",
  "confidence": 0.92,
  "rootCauses": [],
  "evidence": [],
  "recommendations": []
}

This makes AI much easier to render safely in your frontend.

21. Realtime

Mission Control should eventually update without refresh.

Options:

WebSockets
SSE

I'd start with:

SSE

for dashboard events.

Examples:

new incident
metric anomaly
deployment detected
AI insight ready
22. Notifications

Create a notification service.

Notification
├── Email
├── Slack
├── Discord
├── Webhook
└── Teams

Don't make the alert engine directly call Slack.

Use:

Alert
 ↓
Notification Event
 ↓
Notification Worker
 ↓
Provider
23. Billing

You'll need:

Stripe

Eventually.

Track:

telemetry volume
projects
services
retention
AI usage
team members

Your pricing model can therefore be:

Starter
Growth
Enterprise

with the 7-day trial.

24. Object Storage Lifecycle

This is important for your architecture.

I'd use:

HOT
 ↓
WARM
 ↓
COLD
 ↓
DELETE

Example:

0–7 days
Hot queryable data

7–30 days
Warm data

30–90 days
Archive

90+ days
Delete

Exact retention depends on plan.

25. Parquet

If object storage is a core part of your architecture, Parquet should be strongly considered.

Instead of:

millions of JSON files

use:

Parquet

Benefits:

columnar
compressed
efficient analytical reads
cheap object storage
good ecosystem support

You can partition:

org
project
environment
date
event_type
26. Search

Logs require fast search.

Don't rely solely on object storage.

For MVP, consider:

PostgreSQL full-text search

or a dedicated search engine later:

OpenSearch

Don't introduce OpenSearch on day one unless actual requirements justify it.

27. Deployment

You need to deploy:

Web
API
Workers
AI
Scheduler

Potentially:

Docker
+
Kubernetes

But for MVP:

Docker
+
Railway / Fly.io / Render / AWS

can be much simpler.

Eventually:

Kubernetes

for scale.

28. CI/CD

GitHub Actions.

Pipeline:

PR
 ↓
Lint
 ↓
Unit tests
 ↓
Integration tests
 ↓
Build
 ↓
Security scan
 ↓
Deploy
29. Monitoring Soonwhy

This is mandatory.

Soonwhy should monitor Soonwhy.

Your internal installation should monitor:

API
Ingestion
Workers
NATS
Redis
Postgres
Object Storage
AI
Billing
Notifications

This becomes your first real dogfooding environment.

30. Security

You need:

OWASP
Rate limiting
Tenant isolation
RBAC
Encryption
Secrets management
Audit logs
PII redaction
API key rotation
Webhook signing
CSRF protection
CORS
Content security policy

For SDK telemetry:

PII filtering
secret detection
payload limits
sampling
31. Testing

You need multiple layers.

Go
unit
integration
API
repository
worker
Frontend
unit
component
E2E
SDK

This is especially important.

Test:

NestJS
Express
Fastify
Prisma
BullMQ
Redis
Cron
Infrastructure

Test:

ingestion
retry
backpressure
deduplication
tenant isolation
32. Developer Experience

You need excellent docs.

docs.soonwhy.com

Developer should see:

1. Install
2. Add API key
3. Start application
4. Open dashboard

That's it.

33. CLI

Build:

soonwhy init
soonwhy login
soonwhy projects
soonwhy doctor
soonwhy status
soonwhy diagnose

doctor is particularly valuable.

34. Design System

You need:

Tailwind
shadcn/ui
Radix
Lucide

Components:

HealthScore
MetricCard
IncidentCard
AIInsight
Recommendation
TraceWaterfall
LogViewer
ServiceMap
DeploymentTimeline
QueueCard
CronCard
35. Documentation Artifact

This is where our earlier discussion comes in.

You need:

artifacts/

00-company/
01-product/
02-research/
03-architecture/
04-database/
05-api/
06-sdk/
07-ai/
08-design-system/
09-security/
10-infrastructure/
11-testing/
12-roadmap/
13-tasks/
14-decisions/

This should be the source of truth.

36. Recommended Repository

Given your actual stack, I'd structure it like:

soonwhy/

├── apps/
│   ├── web/                 # TanStack Start
│   └── docs/
│
├── services/
│   ├── api/                 # Go + Gin
│   ├── ingestion/           # Go
│   ├── processor/           # Go
│   ├── ai/                  # Go
│   ├── scheduler/           # Go
│   └── notifications/      # Go
│
├── packages/
│   ├── ui/
│   ├── types/
│   └── config/
│
├── sdks/
│   ├── node/
│   ├── python/
│   └── go/
│
├── cli/
│
├── infrastructure/
│   ├── docker/
│   ├── terraform/
│   └── kubernetes/
│
├── database/
│
├── artifacts/
│
├── scripts/
│
├── .github/
│
├── SOONWHY.md
├── AGENTS.md
├── CODEX.md
├── Makefile
└── README.md
37. What You Actually Need for MVP

Don't build all of this immediately.

Your MVP infrastructure can be:

TanStack Start
       │
       ▼
   Go + Gin
       │
 ┌─────┼──────┐
 ▼     ▼      ▼
Redis Postgres R2
       │
       ▼
    NATS
       │
       ▼
   Go Workers
       │
       ▼
   Parquet/R2
       │
       ▼
  Query/Aggregation
       │
       ▼
 Mission Control

Plus:

Soonwhy Node SDK
AI provider
Stripe
Email
GitHub

That's enough to start.

38. One Architectural Warning

I wouldn't completely eliminate an analytical query engine forever.

Your idea of using object storage is good because it gives you:

cheap durable telemetry storage.

But eventually Soonwhy will need extremely fast queries such as:

P99 latency
GROUP BY service
GROUP BY endpoint
OVER 30 days

against potentially billions of events.

Object storage alone isn't designed for this.

So I'd architect it as:

                 Telemetry
                     │
             ┌───────┴───────┐
             ▼               ▼
        Hot Storage       Object Storage
             │               │
             ▼               ▼
        Fast Queries      Parquet Archive

You can start simple and introduce a specialized analytical engine only when scale requires it.

That keeps your MVP much cheaper and easier to operate.

The stack I'd lock in
Layer	Choice
Frontend	TanStack Start
UI	React + Tailwind + shadcn
Backend	Go + Gin
SDK	TypeScript/Node initially
Database	PostgreSQL
Cache	Redis
Event Bus	NATS JetStream
Telemetry archive	S3/R2
Format	Parquet
ORM	sqlc / pgx
Auth	Better Auth/Auth provider
AI	Provider abstraction
Billing	Stripe
Realtime	SSE
Containers	Docker
CI/CD	GitHub Actions
IaC	Terraform later
Observability	OpenTelemetry
CLI	Go
Monorepo	pnpm + Turborepo for TS + Go workspaces/modules

One correction: I wouldn't force Turborepo to manage the Go services. Let Turborepo manage the TypeScript/TanStack/packages side, while Go uses normal Go modules/workspaces. The repository can still be one monorepo.

And I would build Soonwhy in this order
1. Artifact / architecture
        ↓
2. Monorepo
        ↓
3. PostgreSQL + tenancy
        ↓
4. SDK
        ↓
5. Ingestion
        ↓
6. Object storage + Parquet
        ↓
7. Query/aggregation layer
        ↓
8. Mission Control
        ↓
9. Logs / metrics / traces
        ↓
10. Prisma / Redis / BullMQ / Cron
        ↓
11. AI intelligence
        ↓
12. Alerts / incidents
        ↓
13. Billing
        ↓
14. Beta

The next artifact I would create is not another generic PRD. It should be the Soonwhy Technical Architecture Specification based specifically on this stack, followed by the repository specification and then the Phase 0 task breakdown. That gives Codex an exact blueprint instead of leaving it to infer architecture from the PRD.

create teask fro each of the phases in epic format and dependencies 

Absolutely. I would structure Soonwhy as 11 epics rather than treating each phase as one giant task. Each epic should have a clear goal, dependencies, deliverables, and exit criteria, and each task should be small enough for Codex to implement without making architectural decisions on its own.

The dependency graph should be:

EPIC-00 Product & Architecture
          │
          ▼
EPIC-01 Repository & Platform Foundation
          │
          ▼
EPIC-02 Identity, Tenancy & Project Management
          │
          ▼
EPIC-03 SDK & Telemetry Ingestion
          │
          ▼
EPIC-04 Telemetry Storage & Processing
          │
          ▼
EPIC-05 Mission Control
          │
          ├──────────────────────┐
          ▼                      ▼
EPIC-06 Observability       EPIC-07 Developer
     Core                    Intelligence
          │                      │
          └──────────┬───────────┘
                     ▼
              EPIC-08 AI Intelligence
                     │
                     ▼
              EPIC-09 Incidents
                 & Alerts
                     │
                     ▼
              EPIC-10 Billing
              Security & Scale
                     │
                     ▼
              EPIC-11 Beta & GA
Soonwhy Epic & Dependency Plan
EPIC-00 — Product, Architecture & Engineering Foundation

Phase: 0
Priority: P0
Dependencies: None

Objective

Create the authoritative technical/product specification that Codex and developers use throughout the project.

Tasks
SW-0001 — Finalize product requirements
SW-0002 — Finalize MVP scope
SW-0003 — Define product principles
SW-0004 — Define personas and user journeys
SW-0005 — Define pricing model
SW-0006 — Define system architecture
SW-0007 — Define service boundaries
SW-0008 — Define telemetry architecture
SW-0009 — Define multi-tenant architecture
SW-0010 — Define storage architecture
SW-0011 — Define SDK architecture
SW-0012 — Define AI architecture
SW-0013 — Define security architecture
SW-0014 — Define API conventions
SW-0015 — Define error-handling conventions
SW-0016 — Define testing strategy
SW-0017 — Define Git branching strategy
SW-0018 — Create SOONWHY.md
SW-0019 — Create AGENTS.md
SW-0020 — Create Codex development guidelines
SW-0021 — Create Architecture Decision Records
SW-0022 — Create dependency graph
SW-0023 — Define Definition of Done
SW-0024 — Define release strategy
Depends on

None.

Blocks

Everything.

Exit Criteria

A developer/Codex can understand:

what Soonwhy is
what MVP means
how the system works
what technologies are being used
where code belongs
how features should be implemented

without inventing architecture.

EPIC-01 — Repository & Platform Foundation

Phase: 1
Priority: P0
Depends on: EPIC-00

Objective

Create the actual Soonwhy repository and development environment.

Tasks
SW-0101 — Initialize monorepo
SW-0102 — Configure TypeScript workspace
SW-0103 — Configure Go modules
SW-0104 — Create TanStack Start application
SW-0105 — Create Go/Gin API service
SW-0106 — Create Go worker service
SW-0107 — Create shared TypeScript packages
SW-0108 — Create shared Go packages
SW-0109 — Configure environment management
SW-0110 — Configure Docker development environment
SW-0111 — Configure PostgreSQL
SW-0112 — Configure Redis
SW-0113 — Configure NATS JetStream
SW-0114 — Configure object storage locally
SW-0115 — Configure database migrations
SW-0116 — Configure CI
SW-0117 — Configure linting
SW-0118 — Configure formatting
SW-0119 — Configure unit testing
SW-0120 — Configure integration testing
SW-0121 — Configure E2E testing
SW-0122 — Create local developer bootstrap
SW-0123 — Create health-check endpoints
SW-0124 — Create service README files
Depends on

EPIC-00

Blocks

EPIC-02, EPIC-03, EPIC-04

Exit Criteria

Running one command should bring up:

Web
API
PostgreSQL
Redis
NATS
Object Storage
Workers
EPIC-02 — Identity, Tenancy & Project Management

Phase: 1
Priority: P0
Depends on: EPIC-01

Objective

Build the SaaS foundation around organizations, projects and environments.

Tasks
SW-0201 — User model
SW-0202 — Organization model
SW-0203 — Membership model
SW-0204 — Project model
SW-0205 — Environment model
SW-0206 — Service model
SW-0207 — API key model
SW-0208 — Authentication
SW-0209 — Session management
SW-0210 — Organization creation
SW-0211 — Project creation
SW-0212 — Environment management
SW-0213 — API key generation
SW-0214 — API key hashing
SW-0215 — API key revocation
SW-0216 — Tenant resolution middleware
SW-0217 — RBAC foundation
SW-0218 — Tenant isolation tests
SW-0219 — Project dashboard shell
SW-0220 — Environment selector
SW-0221 — API key onboarding flow
Depends on

EPIC-01

Blocks

EPIC-03, EPIC-05

Exit Criteria

A developer can:

Create account
    ↓
Create organization
    ↓
Create project
    ↓
Create Production environment
    ↓
Generate API key
EPIC-03 — Soonwhy SDK & Telemetry Ingestion

Phase: 2
Priority: P0
Depends on: EPIC-02

Objective

Allow developers to install Soonwhy and start sending telemetry with minimal configuration.

SDK Tasks
SW-0301 — Create Node SDK
SW-0302 — SDK configuration
SW-0303 — API key authentication
SW-0304 — Event model
SW-0305 — Event context
SW-0306 — Request instrumentation
SW-0307 — Error instrumentation
SW-0308 — Log instrumentation
SW-0309 — Metric instrumentation
SW-0310 — Trace instrumentation
SW-0311 — Batching
SW-0312 — Buffering
SW-0313 — Retry mechanism
SW-0314 — Backoff mechanism
SW-0315 — Sampling
SW-0316 — Payload limits
SW-0317 — PII filtering
SW-0318 — Secret redaction
SW-0319 — Fail-open behavior
SW-0320 — SDK performance tests
Ingestion Tasks
SW-0321 — Ingestion API
SW-0322 — API key validation
SW-0323 — Tenant resolution
SW-0324 — Payload validation
SW-0325 — Rate limiting
SW-0326 — Idempotency
SW-0327 — NATS publishing
SW-0328 — Ingestion metrics
SW-0329 — Ingestion failure handling
SW-0330 — SDK integration test application
Depends on

EPIC-02

Blocks

EPIC-04

Exit Criteria

This should work:

npm install @soonwhy/sdk
Soonwhy.init({
  apiKey: process.env.SOONWHY_API_KEY
});

Then:

Application
    ↓
SDK
    ↓
Gin
    ↓
NATS
EPIC-04 — Telemetry Storage & Processing

Phase: 2
Priority: P0
Depends on: EPIC-03

Objective

Build the telemetry processing pipeline and object-storage architecture.

Tasks
SW-0401 — Define telemetry schemas
SW-0402 — Define event normalization
SW-0403 — Create telemetry consumer
SW-0404 — Create processing workers
SW-0405 — Create enrichment pipeline
SW-0406 — Create event deduplication
SW-0407 — Create partition strategy
SW-0408 — Implement Parquet generation
SW-0409 — Implement object-storage writer
SW-0410 — Implement object-storage reader
SW-0411 — Implement telemetry retention
SW-0412 — Implement telemetry compression
SW-0413 — Implement aggregation
SW-0414 — Create metrics aggregation tables
SW-0415 — Create query abstraction
SW-0416 — Create hot-data strategy
SW-0417 — Create cold-data strategy
SW-0418 — Implement backpressure
SW-0419 — Implement dead-letter handling
SW-0420 — Pipeline load testing
Depends on

EPIC-03

Blocks

EPIC-05, EPIC-06

Exit Criteria

Telemetry flows:

SDK
 ↓
Gin
 ↓
NATS
 ↓
Worker
 ↓
Normalize
 ↓
Aggregate
 ↓
Parquet
 ↓
Object Storage

and can be queried by the application.

EPIC-05 — Mission Control

Phase: 3
Priority: P0
Depends on: EPIC-02, EPIC-04

Objective

Create Soonwhy's primary developer experience.

Tasks
SW-0501 — Mission Control layout
SW-0502 — Health score
SW-0503 — Application summary
SW-0504 — Request overview
SW-0505 — Error overview
SW-0506 — Latency overview
SW-0507 — Service overview
SW-0508 — Active issues
SW-0509 — Recommendations panel
SW-0510 — Recent deployments
SW-0511 — Metric cards
SW-0512 — Time-series charts
SW-0513 — Date/time filtering
SW-0514 — Environment filtering
SW-0515 — Service filtering
SW-0516 — Realtime updates
SW-0517 — Empty states
SW-0518 — Loading states
SW-0519 — Error states
SW-0520 — Mission Control E2E tests
Depends on

EPIC-04

Blocks

EPIC-08, EPIC-09

Exit Criteria

A developer sees:

Your application is healthy.

or:

Your application needs attention.

without navigating through multiple observability screens.

EPIC-06 — Observability Core

Phase: 4
Priority: P0
Depends on: EPIC-04, EPIC-05

Objective

Build the detailed observability experience underneath Mission Control.

Logs
SW-0601 — Log storage
SW-0602 — Log search
SW-0603 — Log filtering
SW-0604 — Structured log viewer
SW-0605 — Log context
SW-0606 — Log-to-trace navigation
Metrics
SW-0610 — Metric ingestion
SW-0611 — Metric aggregation
SW-0612 — Metric querying
SW-0613 — Metric charts
SW-0614 — P50/P95/P99 calculations
SW-0615 — Custom metrics
Traces
SW-0620 — Trace ingestion
SW-0621 — Span processing
SW-0622 — Trace storage
SW-0623 — Trace querying
SW-0624 — Trace waterfall
SW-0625 — Trace details
SW-0626 — Trace-to-log navigation
API monitoring
SW-0630 — Endpoint discovery
SW-0631 — Endpoint metrics
SW-0632 — Status code analysis
SW-0633 — Endpoint latency
SW-0634 — Endpoint error rates
SW-0635 — API performance dashboard
Exit Criteria

Soonwhy can compete at the basic observability level with the major tools you're taking inspiration from.

EPIC-07 — Developer Intelligence Integrations

Phase: 5
Priority: P0
Depends on: EPIC-06

This is one of the most strategically important epics.

Prisma
SW-0701 — Prisma instrumentation
SW-0702 — Query tracking
SW-0703 — Slow-query detection
SW-0704 — Query frequency analysis
SW-0705 — N+1 detection
SW-0706 — Query regression detection
Redis
SW-0710 — Redis instrumentation
SW-0711 — Redis latency
SW-0712 — Redis errors
SW-0713 — Redis connection monitoring
SW-0714 — Redis memory monitoring
BullMQ
SW-0720 — BullMQ instrumentation
SW-0721 — Queue discovery
SW-0722 — Queue depth
SW-0723 — Job processing time
SW-0724 — Failed jobs
SW-0725 — Retry tracking
SW-0726 — Worker health
Cron
SW-0730 — Cron registration
SW-0731 — Execution tracking
SW-0732 — Failure detection
SW-0733 — Duration tracking
SW-0734 — Missed execution detection
SW-0735 — Schedule drift detection
Dependency mapping
SW-0740 — Service dependency model
SW-0741 — Dependency discovery
SW-0742 — Dependency graph
SW-0743 — Dependency health
Exit Criteria

Soonwhy understands:

API
 ↓
Prisma
 ↓
Postgres

API
 ↓
Redis
 ↓
BullMQ
 ↓
Worker

Cron
 ↓
API
 ↓
Database

This is where Soonwhy starts becoming more than SigNoz with a nicer dashboard.

EPIC-08 — AI Intelligence

Phase: 6
Priority: P0
Depends on: EPIC-05, EPIC-06, EPIC-07

Objective

Turn telemetry into explanations.

Tasks
SW-0801 — AI provider abstraction
SW-0802 — AI configuration
SW-0803 — Telemetry context builder
SW-0804 — Evidence extraction
SW-0805 — Anomaly context generation
SW-0806 — Deployment correlation
SW-0807 — Database correlation
SW-0808 — Queue correlation
SW-0809 — Cron correlation
SW-0810 — Root-cause engine
SW-0811 — Confidence scoring
SW-0812 — Evidence model
SW-0813 — AI summary
SW-0814 — AI recommendations
SW-0815 — AI chat
SW-0816 — AI conversation history
SW-0817 — Structured AI responses
SW-0818 — Hallucination safeguards
SW-0819 — AI evaluation dataset
SW-0820 — AI accuracy testing
Exit Criteria

Developer can ask:

Why is /payments slow?

and receive an answer based on actual telemetry.

Not:

"It could be your database."

But:

"Latency increased 41% after deployment #143. The payments.user_id query accounts for 68% of the increase."

EPIC-09 — Incidents, Anomalies & Alerts

Phase: 7
Priority: P0
Depends on: EPIC-06, EPIC-07, EPIC-08

Tasks
Detection
SW-0901 — Threshold detection
SW-0902 — Rate-of-change detection
SW-0903 — Anomaly detection
SW-0904 — Regression detection
SW-0905 — Deployment correlation
Incidents
SW-0910 — Incident model
SW-0911 — Incident creation
SW-0912 — Incident lifecycle
SW-0913 — Incident timeline
SW-0914 — Incident evidence
SW-0915 — Incident AI summary
SW-0916 — Incident root cause
Alerts
SW-0920 — Alert rules
SW-0921 — Alert evaluation
SW-0922 — Alert deduplication
SW-0923 — Alert suppression
SW-0924 — Alert routing
Notifications
SW-0930 — Email
SW-0931 — Slack
SW-0932 — Discord
SW-0933 — Webhooks
Exit Criteria

Soonwhy can independently detect:

Problem
 ↓
Incident
 ↓
Evidence
 ↓
Root cause
 ↓
Notification
EPIC-10 — Billing, Security, Reliability & Scale

Phase: 8
Priority: P0
Depends on: EPIC-09

This epic makes Soonwhy commercially viable.

Billing
SW-1001 — Pricing configuration
SW-1002 — Trial management
SW-1003 — Stripe integration
SW-1004 — Subscription lifecycle
SW-1005 — Usage metering
SW-1006 — Telemetry limits
SW-1007 — Retention limits
SW-1008 — Billing portal
SW-1009 — Plan enforcement
Security
SW-1010 — Security review
SW-1011 — Tenant isolation audit
SW-1012 — API security
SW-1013 — API key rotation
SW-1014 — Secret management
SW-1015 — PII redaction
SW-1016 — Audit logs
SW-1017 — Rate-limit hardening
SW-1018 — Dependency security scanning
SW-1019 — Penetration testing
Reliability
SW-1020 — Backup strategy
SW-1021 — Disaster recovery
SW-1022 — NATS recovery
SW-1023 — PostgreSQL recovery
SW-1024 — Object-storage recovery
SW-1025 — Worker recovery
SW-1026 — Backpressure testing
SW-1027 — Load testing
Exit Criteria

A real customer can pay for Soonwhy and use it safely in production.

EPIC-11 — Beta, Launch & General Availability

Phase: 9/10
Priority: P0
Depends on: EPIC-10

Beta
SW-1101 — Beta onboarding
SW-1102 — Developer documentation
SW-1103 — SDK quickstarts
SW-1104 — Feedback collection
SW-1105 — Product analytics
SW-1106 — Trial analytics
SW-1107 — Time-to-understanding measurement
SW-1108 — AI feedback system
SW-1109 — SDK error reporting
Performance
SW-1110 — SDK benchmarking
SW-1111 — Ingestion load testing
SW-1112 — Dashboard performance testing
SW-1113 — AI latency testing
SW-1114 — Storage cost analysis
Launch
SW-1120 — Production infrastructure
SW-1121 — Production deployment
SW-1122 — Status page
SW-1123 — Documentation site
SW-1124 — Pricing page
SW-1125 — Signup flow
SW-1126 — Trial flow
SW-1127 — Billing flow
SW-1128 — Marketing website
GA
SW-1130 — GA readiness review
SW-1131 — Security sign-off
SW-1132 — Reliability sign-off
SW-1133 — Documentation sign-off
SW-1134 — Pricing sign-off
SW-1135 — General availability release
Dependency Matrix

Here's the important part for Codex:

Epic	Depends On	Can Start
EPIC-00	—	Immediately
EPIC-01	00	After 00
EPIC-02	01	After 01
EPIC-03	02	After 02
EPIC-04	03	After 03
EPIC-05	02, 04	After 04
EPIC-06	04, 05	After 05
EPIC-07	06	After 06
EPIC-08	05, 06, 07	After 07
EPIC-09	06, 07, 08	After 08
EPIC-10	09	After 09
EPIC-11	10	After 10
But We Can Parallelize

The dependency graph doesn't mean everything has to be sequential.

For example, after EPIC-03:

                 EPIC-03
                    │
             ┌──────┴──────┐
             ▼             ▼
         EPIC-04        SDK Docs
             │
             ▼
         EPIC-05
             │
       ┌─────┴─────┐
       ▼           ▼
   EPIC-06      Frontend
       │
       ▼
   EPIC-07

And within an epic:

Database instrumentation
        │
        ├── Query tracking
        │
        ├── Slow query detection
        │
        └── Query aggregation

Those can often be worked on independently once the underlying contracts exist.

The Most Important Dependency Rule

I would add this rule to CODEX.md:

Codex MUST NOT implement a task whose dependency is incomplete unless the dependency is explicitly marked as an approved exception.

For example:

SW-0810 Root Cause Engine

depends on:

SW-0803 Context Builder
SW-0804 Evidence Extraction
SW-0806 Deployment Correlation
SW-0807 Database Correlation
SW-0808 Queue Correlation
SW-0809 Cron Correlation

Codex shouldn't start writing the root-cause engine based on assumptions about those systems.

Definition of Done for Every Task

Every SW-* task should require:

□ Requirements understood
□ Existing architecture checked
□ Implementation completed
□ Unit tests
□ Integration tests where applicable
□ Error handling
□ Logging
□ Security considerations
□ Documentation updated
□ No unrelated changes
□ Lint passes
□ Tests pass
□ Build passes
□ Task marked complete
And I would make the task hierarchy look like this
EPIC-03 — SDK & Telemetry Ingestion
│
├── SW-0301 — Node SDK
│   ├── SW-0301.1 SDK package
│   ├── SW-0301.2 Configuration
│   ├── SW-0301.3 API key
│   └── SW-0301.4 Initialization
│
├── SW-0311 — Batching
│   ├── SW-0311.1 Event buffer
│   ├── SW-0311.2 Flush threshold
│   ├── SW-0311.3 Flush interval
│   └── SW-0311.4 Graceful shutdown
│
└── SW-0321 — Ingestion API
    ├── SW-0321.1 Endpoint
    ├── SW-0321.2 Authentication
    ├── SW-0321.3 Validation
    └── SW-0321.4 NATS publishing

That gives us Epic → Task → Subtask, which is much better for Codex than giving it 100 huge tasks.

Recommended first implementation sequence

If we're actually starting development now, I'd use:

EPIC-00
  ↓
EPIC-01
  ↓
EPIC-02
  ↓
EPIC-03
  ↓
EPIC-04
  ↓
EPIC-05

And stop there for the first vertical slice.

At that point we should have:

Real Application
      │
      ▼
Soonwhy SDK
      │
      ▼
Go/Gin Ingestion
      │
      ▼
NATS
      │
      ▼
Go Processor
      │
      ▼
Object Storage
      │
      ▼
Query/Aggregation
      │
      ▼
TanStack Start
      │
      ▼
Mission Control

That is the first major milestone:

"I installed Soonwhy in a real application and can see what my application is doing."

Then we deepen it with observability → developer intelligence → AI → incidents → billing.

This is the structure I'd put into the Soonwhy repository as tasks/EPICS.md, with each epic eventually getting its own tasks/EPIC-XX.md containing the full implementation specifications.