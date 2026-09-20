# Soonwhy — MVP Scope & Success Metrics

## MVP Feature List

### Core Telemetry Collection

| Feature | Description | Priority |
|---------|-------------|----------|
| **Log ingestion** | Structured JSON logs with timestamp, level, message, attributes | P0 |
| **Metric ingestion** | Counters, gauges, histograms via SDK | P0 |
| **Trace ingestion** | Distributed traces with spans via OpenTelemetry | P0 |
| **Request tracking** | HTTP request/response pairs with latency, status, endpoint | P0 |
| **Error tracking** | Automatic error capture with stack traces | P0 |

### SDK

| Feature | Description | Priority |
|---------|-------------|----------|
| **Node.js/TypeScript SDK** | Auto-instrumentation for Express, Fastify, NestJS | P0 |
| **Manual instrumentation** | Custom spans, logs, metrics | P0 |
| **Context propagation** | W3C Trace Context headers | P0 |
| **Batching** | Local batching to reduce network calls | P0 |
| **Retry logic** | Exponential backoff with jitter | P0 |

### Storage

| Feature | Description | Priority |
|---------|-------------|----------|
| **Hot storage (ClickHouse)** | Self-hosted, 7-day retention, fast analytical queries | P0 |
| **Cold storage (R2 + Parquet)** | Long-term retention, cost-efficient | P0 |
| **Automatic lifecycle** | Hot → Cold migration after 7 days | P0 |

### AI Analysis

| Feature | Description | Priority |
|---------|-------------|----------|
| **Anomaly detection** | Automatic identification of unusual patterns | P1 |
| **Root cause analysis** | Evidence-backed explanations of why something broke | P1 |
| **Correlation engine** | Link events across signals (latency ↔ errors ↔ deployments) | P1 |
| **Confidence scoring** | 0-1 confidence with evidence citations | P0 |

### Mission Control

| Feature | Description | Priority |
|---------|-------------|----------|
| **Dashboard** | Health score, error rate, latency, throughput | P0 |
| **Log viewer** | Structured log search and filtering | P0 |
| **Trace viewer** | Span waterfall visualization | P0 |
| **Metric explorer** | Time-series charts with drill-down | P0 |
| **AI chat** | Ask questions about your telemetry | P1 |

### Deployment

| Feature | Description | Priority |
|---------|-------------|----------|
| **Docker Compose** | Self-hosted on Dokploy | P0 |
| **Environment support** | Production, staging, development | P0 |
| **Multi-project** | Multiple apps per organization | P0 |

### Pricing

| Feature | Description | Priority |
|---------|-------------|----------|
| **Usage metering** | Track ingestion, storage, API calls | P0 |
| **Pay-as-you-go** | No minimums, no seat licenses | P0 |
| **Free tier** | 1GB/month ingestion, 1GB storage | P0 |

---

## Out-of-Scope (Post-MVP)

### SDKs (v2+)
- Python SDK
- Go SDK
- Java SDK
- Ruby SDK
- Browser SDK (client-side telemetry)

### Advanced AI (v2+)
- Predictive analytics (forecast issues before they happen)
- Auto-remediation (suggest or execute fixes)
- Predictive analytics and auto-remediation
- AI-generated runbooks

### Enterprise Features (v3+)
- SSO/SAML integration
- Role-based access control (RBAC)
- Audit logging
- Compliance reports (SOC2, HIPAA)
- Data residency controls

### Advanced Dashboarding (v2+)
- Custom dashboards
- Alert rules and notifications
- Slack/PagerDuty integrations
- Mobile app
- Scheduled reports

### Multi-Tenancy
- Organization management
- Team collaboration
- Billing per team
- Cost allocation

Organization and tenant boundaries are MVP prerequisites for project ownership, telemetry isolation, usage metering, and access control.

### Advanced Storage (v3+)
- Custom retention policies
- Cross-region replication
- Data export APIs
- Custom Parquet schemas

---

## Success Metrics

### Primary Metrics

| Metric | Target | Measurement | Why It Matters |
|--------|--------|-------------|----------------|
| **Time to Understanding (TTU)** | < 5 minutes | From SDK install to first insight | Core value proposition |
| **Onboarding completion rate** | > 80% | Users who complete setup and see data | Low barrier to adoption |
| **SDK installation success rate** | > 95% | Successful `npm install` + first telemetry sent | Developer experience |
| **Trial conversion rate** | > 20% | Free tier → paid | Business viability |
| **Monthly retention** | > 85% | Users active after 30 days | Product stickiness |

### Secondary Metrics

| Metric | Target | Measurement | Why It Matters |
|--------|--------|-------------|----------------|
| **MTTR reduction** | > 50% | Time to resolve incidents with vs. without | Value demonstration |
| **AI root-cause accuracy** | > 80% | Correct root causes on a versioned evaluation set, using a predefined rubric | Trust in product |
| **Cost predictability** | Linear | Spend scales linearly with usage | No surprise bills |
| **Integration time** | < 30 minutes | From signup to production data | Time to value |
| **API latency** | < 200ms | P95 latency for ingestion API | Performance |

### Leading Indicators

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **Daily active SDKs** | Growing week-over-week | Adoption signal |
| **Telemetry volume per user** | Growing | Value realization |
| **AI queries per user** | Growing | Engagement signal |
| **Support tickets per user** | Decreasing | Product maturity |
| **Time to first AI insight** | < 10 minutes | Value speed |

---

## AI Evaluation Method

AI accuracy is measured against a versioned evaluation dataset of representative incidents with known root causes. Each response is scored against a fixed rubric: root-cause correctness, supporting-evidence correctness, and unsupported-claim rate. Accuracy is the percentage of evaluation cases meeting the required correctness threshold. The dataset and rubric are versioned with each GA evaluation.

## Launch Criteria

### Beta Launch (Internal)

| Criteria | Target | Status |
|----------|--------|--------|
| SDK sends telemetry to API | Working | |
| ClickHouse stores and queries data | Working | |
| Basic dashboard shows health score | Working | |
| AI produces evidence-backed insights | Working | |
| Docker Compose deployment works | Working | |
| 3 internal users testing | Complete | |

### General Availability (GA)

| Criteria | Target | Status |
|----------|--------|--------|
| TTU < 5 minutes for new users | Verified | |
| Onboarding completion > 80% | Verified | |
| SDK success rate > 95% | Verified | |
| AI accuracy > 80% | Verified | |
| P95 API latency < 200ms | Verified | |
| Documentation complete | Verified | |
| 10 beta users providing feedback | Complete | |
| Billing system working | Verified | |

---

## MVP Milestones

| Milestone | Target Date | Deliverables |
|-----------|-------------|--------------|
| **M1: Core SDK** | Week 4 | Node.js SDK with auto-instrumentation |
| **M2: Ingestion API** | Week 6 | API receives, validates, stores telemetry |
| **M3: Storage Layer** | Week 8 | ClickHouse + R2 with lifecycle |
| **M4: Mission Control** | Week 10 | Dashboard with health score, logs, traces |
| **M5: AI Engine** | Week 12 | Anomaly detection + root cause analysis |
| **M6: Beta Launch** | Week 14 | Internal testing with 3 users |
| **M7: GA** | Week 18 | Public launch with 10+ users |

---

## Key Assumptions

1. **Self-hosted ClickHouse is reliable enough** — We're betting on Dokploy to keep ClickHouse running. If it's not reliable, we'll need to consider managed alternatives.

2. **AI accuracy > 80% is achievable** — Evidence-gated responses should be more accurate than generic suggestions. If not, we'll need to refine the approach.

3. **Developers want SDK-first** — We're assuming developers prefer explicit SDK integration over agent-based magic. If adoption is slow, we may need to add agent support.

4. **Pay-as-you-go works at scale** — We're assuming usage-based pricing is attractive. If developers prefer fixed pricing, we'll need to adjust.

5. **5-minute TTU is achievable** — We're assuming SDK integration is simple enough for 5-minute time to value. If not, we'll need to simplify the SDK.
