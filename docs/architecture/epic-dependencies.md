# Epic Dependency Graph

Visual dependency map of all 10 build phases with critical path analysis, parallelization opportunities, and blocking relationships.

## Dependency Diagram

```
                        ┌─────────────────────────────────────────────────────────────────┐
                        │                    CRITICAL PATH (🔴)                          │
                        │  P0 → P1 → P2 → P4 → P5 → P6 → P7 → P8 → P9 → P10            │
                        └─────────────────────────────────────────────────────────────────┘

                         Phase 0                    Phase 1                    Phase 2
                      ┌───────────┐             ┌───────────┐             ┌───────────┐
                      │  Product  │             │ Platform  │             │    SDK    │
                      │ Foundation│────────────▶│ Foundation│────────────▶│& Ingestion│
                      │  (1 wk)   │             │  (2 wks)  │             │  (2 wks)  │
                      └───────────┘             └───────────┘             └─────┬─────┘
                                                                                │
                                                   ┌────────────────────────────┤
                                                   │                            │
                                                   ▼                            ▼
                                            ┌───────────┐                ┌───────────┐
                                            │ Mission   │                │Observability│
                              ╔═══════════▶│  Control  │                │    Core   │
                              ║            │  (2 wks)  │                │  (2 wks)  │
                              ║            └───────────┘                └─────┬─────┘
                              ║                                               │
                              ║         Parallel Track A                      │
                              ║         (UI + Dashboard)                      │
                              ║                                               ▼
                              ║                                        ┌───────────┐
                              ║                                        │Developer  │
                              ╚════════════════════════════════════════▶│Intelligence│
                                                                       │  (3 wks)  │
                                                                       └─────┬─────┘
                                                                             │
                                                                             ▼
                                                                       ┌───────────┐
                                                                       │    AI     │
                                                                       │Intelligence│
                                                                       │  (3 wks)  │
                                                                       └─────┬─────┘
                                                                             │
                                                         ┌───────────────────┤
                                                         │                   │
                                                         ▼                   ▼
                                                  ┌───────────┐      ┌───────────┐
                                                  │ Incidents │      │Production │
                                                  │&  Alerts  │      │ & Billing │
                                                  │  (2 wks)  │      │  (3 wks)  │
                                                  └─────┬─────┘      └─────┬─────┘
                                                        │                  │
                                                        └────────┬─────────┘
                                                                 │
                                                                 ▼
                                                           ┌───────────┐
                                                           │   Beta    │
                                                           │  (2 wks)  │
                                                           └─────┬─────┘
                                                                 │
                                                                 ▼
                                                           ┌───────────┐
                                                           │    GA     │
                                                           │  (2 wks)  │
                                                           └───────────┘
```

## Phase Summary

| Phase | Name | Duration | Depends On | Blocks |
|-------|------|----------|------------|--------|
| P0 | Product Foundation | 1 week | — | P1 |
| P1 | Platform Foundation | 2 weeks | P0 | P2 |
| P2 | SDK & Ingestion | 2 weeks | P1 | P3, P4 |
| P3 | Mission Control | 2 weeks | P2 | P8 (partial) |
| P4 | Observability Core | 2 weeks | P2 | P5 |
| P5 | Developer Intelligence | 3 weeks | P4 | P6 |
| P6 | AI Intelligence | 3 weeks | P5 | P7 |
| P7 | Incidents & Alerts | 2 weeks | P6 | P9 |
| P8 | Production & Billing | 3 weeks | P6 | P9 |
| P9 | Beta | 2 weeks | P7, P8 | P10 |
| P10 | General Availability | 2 weeks | P9 | — |

**Total critical path: ~22 weeks**

## Blocking Relationships

### Hard Blocks (must complete before next can start)

```
P0 ──▶ P1    Product spec required to build platform
P1 ──▶ P2    Auth, tenancy, projects required for SDK/API
P2 ──▶ P4    Telemetry pipeline required for observability data
P4 ──▶ P5    Observability signals required for developer intelligence
P5 ──▶ P6    Developer signals required for AI analysis
P6 ──▶ P7    AI analysis required for incident detection
P7 ──▶ P9    Incidents must work before beta
P8 ──▶ P9    Billing must work before beta
P9 ──▶ P10   Beta feedback required for GA
```

### Soft Blocks (can start with partial completion)

```
P2 ──▶ P3    Mission Control needs basic telemetry (can start after P2 MVP)
P6 ──▶ P8    Billing can start while AI work finishes
```

## Parallelization Opportunities

### Track A: UI + Dashboard (parallel with Track B)

```
P2 ──▶ P3 (Mission Control)
              │
              └──▶ P8 (billing UI components)
```

**Starts after:** P2 complete
**Can run parallel with:** P4, P5, P6

### Track B: Data + Intelligence (parallel with Track A)

```
P2 ──▶ P4 ──▶ P5 ──▶ P6 ──▶ P7
```

**Starts after:** P2 complete
**Can run parallel with:** P3

### Track C: Production Readiness (parallel, late-stage)

```
P6 ──▶ P8 (infrastructure + billing)
```

**Starts after:** P6 complete
**Can run parallel with:** P7 (partially)

## Critical Path Analysis

The **critical path** is the longest sequence of dependent phases that determines minimum total duration:

```
P0 → P1 → P2 → P4 → P5 → P6 → P7 → P9 → P10
```

**Duration:** 1 + 2 + 2 + 2 + 3 + 3 + 2 + 2 + 2 = **20 weeks**

### Why This Is Critical

Any delay on these phases directly delays the entire project. P3 and P8 have slack:

- **P3 (Mission Control):** 2 weeks of slack — can start 2 weeks late without affecting P9
- **P8 (Production & Billing):** 1 week of slack — can start 1 week late without affecting P9

## MVP Vertical Slice (P0 → P5)

The minimum viable product delivers a working observability experience:

```
P0 ──▶ P1 ──▶ P2 ──▶ P3 ──▶ P4 ──▶ P5
                       │       │       │
                       │       │       └── Developer intelligence for
                       │       │           Prisma, Redis, BullMQ, Cron
                       │       │
                       │       └── Logs, metrics, traces, APIs
                       │
                       └── Dashboard with health score, services, errors
```

**MVP Exit Criteria:**

| Phase | Exit Condition |
|-------|----------------|
| P0 | AI agent understands Soonwhy without asking architectural questions |
| P1 | Org → Project → Environment → API Key creation works |
| P2 | Real NestJS app sends telemetry, Soonwhy stores it |
| P3 | Developer installs SDK and immediately understands app state |
| P4 | Soonwhy is a legitimate observability platform |
| P5 | Soonwhy understands application internals, not just generic telemetry |

## Parallel Execution Schedule

### Weeks 1–3: Foundation (sequential)

```
Week 1:  [P0 Product Foundation]
Week 2:  [P1 Platform Foundation]
Week 3:  [P1 Platform Foundation]
```

### Weeks 4–5: Telemetry Pipeline (sequential)

```
Week 4:  [P2 SDK & Ingestion]
Week 5:  [P2 SDK & Ingestion]
```

### Weeks 6–7: Parallel Tracks (2 weeks)

```
Week 6:  [P3 Mission Control] [P4 Observability Core]
Week 7:  [P3 Mission Control] [P4 Observability Core]
```

### Weeks 8–10: Intelligence Layer (3 weeks)

```
Week 8:  [P5 Developer Intelligence]
Week 9:  [P5 Developer Intelligence]
Week 10: [P5 Developer Intelligence]
```

### Weeks 11–13: AI + Production (3 weeks)

```
Week 11: [P6 AI Intelligence]  [P8 Production & Billing]
Week 12: [P6 AI Intelligence]  [P8 Production & Billing]
Week 13: [P6 AI Intelligence]  [P8 Production & Billing]
```

### Weeks 14–15: Incidents (2 weeks)

```
Week 14: [P7 Incidents & Alerts]
Week 15: [P7 Incidents & Alerts]
```

### Weeks 16–17: Beta (2 weeks)

```
Week 16: [P9 Beta]
Week 17: [P9 Beta]
```

### Weeks 18–19: GA (2 weeks)

```
Week 18: [P10 General Availability]
Week 19: [P10 General Availability]
```

## Risk Factors

| Risk | Impact | Mitigation |
|------|--------|------------|
| P2 SDK quality issues | Blocks all downstream | Early integration testing with real apps |
| P4 ClickHouse performance | Delays P5, P6 | Load test with synthetic data in P2 |
| P6 LLM costs/latency | Delays P7, P8 | Implement caching, rate limiting, fallbacks |
| P8 Stripe integration | Blocks P9 | Start billing UI in P3, backend in P6 |
| P9 beta feedback | May require rework | Timebox feedback collection, prioritize ruthlessly |

## Service Mapping

Each phase maps to specific services (see `services.md`):

| Phase | Primary Services | Supporting Services |
|-------|-----------------|---------------------|
| P1 | API Service | PostgreSQL, Redis |
| P2 | Ingestion Worker, API Service | NATS JetStream, Redis |
| P3 | API Service (UI) | PostgreSQL, Redis |
| P4 | Processor Worker | ClickHouse, R2, NATS |
| P5 | API Service | PostgreSQL, Redis |
| P6 | AI Worker | PostgreSQL, Redis, NATS |
| P7 | Notifications Service, Scheduler | NATS, SendGrid/Slack |
| P8 | API Service (billing) | Stripe, PostgreSQL |
| P9 | All services | Monitoring, logging |
| P10 | All services | Kubernetes, multi-region |
