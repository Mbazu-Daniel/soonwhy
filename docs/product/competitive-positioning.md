# Soonwhy — Competitive Positioning

## Positioning Statement

**Soonwhy is the observability platform that explains WHY your app is broken, not just THAT it's broken.**

We combine telemetry collection, intelligent analysis, and evidence-backed insights to reduce mean time to resolution from hours to minutes. Unlike competitors that show you dashboards and leave you to figure it out, Soonwhy's AI engine correlates signals across logs, metrics, and traces to identify root causes with specific evidence.

---

## Competitor Analysis

### Datadog

**Overview**
- SaaS-only, agent-based observability platform
- Broad feature coverage: infrastructure, APM, logs, RUM, security
- 850+ integrations
- Market leader with $152K median contract

**Pricing (2026)**
| Tier | Price | What's Included |
|------|-------|-----------------|
| Free | $0 | 5 hosts, 1-day retention |
| Infrastructure Pro | $18/host/month | 15-month retention, 850+ integrations |
| Infrastructure Enterprise | $27/host/month | ML alerts, SAML, RBAC |
| APM | $31/host/month | Distributed tracing, service maps |
| Log Management | $0.10/GB | Centralized logging |

**Strengths**
- Comprehensive feature set
- Mature integrations ecosystem
- Strong brand recognition

**Weaknesses**
- Expensive at scale ($152K median contract)
- Per-host pricing creates bill shock with Kubernetes
- AI suggestions are generic, not evidence-backed
- No self-hosted option
- 17+ documented hidden costs

**How Soonwhy Wins**
- Pay-as-you-go (no per-host fees)
- Self-hosted option (data stays in your VPC)
- Evidence-gated AI (not generic suggestions)
- 50%+ cheaper at most usage levels

---

### SigNoz

**Overview**
- Open-source, OpenTelemetry-native observability
- ClickHouse-backed storage
- Self-hosted (Community Edition) or managed cloud
- Growing fast (27K+ GitHub stars)

**Pricing (2026)**
| Tier | Price | What's Included |
|------|-------|-----------------|
| Community | Free | Self-hosted, no limits |
| Teams Cloud | $49/month + $0.30/GB | Managed cloud, support |
| Enterprise | $4,000/month | SSO, SLA, dedicated support |

**Strengths**
- Open-source with active community
- ClickHouse-backed (fast queries)
- Usage-based pricing (no per-host)
- Strong OpenTelemetry support

**Weaknesses**
- No AI-powered root cause analysis
- UI still catching up to Datadog
- Self-hosted requires ClickHouse expertise
- Enterprise features incomplete (RBAC, SSO)

**How Soonwhy Wins**
- AI-powered root cause analysis (SigNoz has none)
- Evidence-gated responses (more trustworthy)
- Simpler self-hosted deployment (Docker Compose on Dokploy)
- Better developer experience (SDK-first, not agent-based)

---

### Grafana Cloud

**Overview**
- Managed version of Grafana stack (Grafana, Loki, Tempo, Mimir)
- Open-source core with cloud managed service
- Strong dashboarding and visualization
- Free tier with generous limits

**Pricing (2026)**
| Tier | Price | What's Included |
|------|-------|-----------------|
| Free | $0 | 10K series, 50GB logs/traces |
| Pro | $19/month + usage | Higher limits, more retention |
| Enterprise | $25,000/year minimum | Premium support, SLA |

**Strengths**
- Most generous free tier for metrics
- Open-source stack (no lock-in)
- Powerful dashboarding
- Large community

**Weaknesses**
- Complex pricing (multiple billing meters)
- Steep learning curve
- No AI-powered analysis
- Usage pricing can get expensive at scale

**How Soonwhy Wins**
- AI-powered root cause analysis (Grafana has none)
- Simpler pricing (one metric: data volume)
- Lower learning curve
- SDK-first integration (not agent-based)

---

### New Relic

**Overview**
- SaaS observability platform with consumption-based pricing
- 100GB free data ingest per month
- User-based pricing (full platform users)
- Strong APM and distributed tracing

**Pricing (2026)**
| Tier | Price | What's Included |
|------|-------|-----------------|
| Free | $0 | 100GB/month, 1 full user |
| Standard | $0 (pay per user) | $10/first user, $99/additional |
| Pro | $0 (pay per user) | $349/full user (annual) |
| Enterprise | Custom | Volume discounts, SLA |

**Strengths**
- Generous free tier (100GB/month)
- Strong APM capabilities
- 50+ platform capabilities
- Good integration ecosystem

**Weaknesses**
- Expensive at scale ($111K median contract)
- User-based pricing creates friction
- No self-hosted option
- AI features are basic

**How Soonwhy Wins**
- Pay-as-you-go (no user fees)
- Self-hosted option
- Evidence-gated AI (more trustworthy)
- Better developer experience

---

### Tinybird

**Overview**
- Managed ClickHouse platform for real-time analytics
- SQL-to-API workflow
- Focus on analytics features, not full observability
- Strong for building analytics into products

**Pricing (2026)**
| Tier | Price | What's Included |
|------|-------|-----------------|
| Free | $0 | 10GB storage, 10 QPS |
| Developer | $49/month | More resources, support |
| SaaS | Custom | Shared infrastructure |
| Enterprise | Custom | Dedicated cluster |

**Strengths**
- Managed ClickHouse (no ops)
- SQL-to-API workflow
- Real-time analytics
- Good developer experience

**Weaknesses**
- Not an observability platform (analytics only)
- No log/metric/trace collection
- No AI-powered analysis
- ClickHouse SQL learning curve

**How Soonwhy Wins**
- Full observability platform (not just analytics)
- AI-powered root cause analysis
- Evidence-gated responses
- SDK-first integration

---

## Feature Comparison Matrix

| Feature | Soonwhy | Datadog | SigNoz | Grafana | New Relic | Tinybird |
|---------|---------|---------|--------|---------|-----------|----------|
| **AI Root Cause Analysis** | 🧭 Planned for MVP | ⚠️ Generic | ❌ None | ❌ None | ⚠️ Basic | ❌ None |
| **Self-Hosted Option** | 🧭 Planned for MVP | ❌ No | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **SDK-First Integration** | 🧭 Planned for MVP | ❌ Agent-based | ⚠️ OTel-based | ❌ Agent-based | ⚠️ Agent-based | ❌ API-only |
| **Pay-As-You-Go** | ✅ Yes | ❌ Per-host | ✅ Yes | ⚠️ Complex | ❌ Per-user | ✅ Yes |
| **Free Tier** | ✅ 1GB/month | ✅ 5 hosts | ✅ Unlimited | ✅ 10K series | ✅ 100GB | ✅ 10GB |
| **OpenTelemetry Native** | ✅ Yes | ⚠️ Partial | ✅ Yes | ✅ Yes | ⚠️ Partial | ❌ No |
| **ClickHouse Storage** | ✅ Yes | ❌ No | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Cold Storage (R2+Parquet)** | 🧭 Planned for MVP | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **Evidence-Based AI** | 🧭 Planned for MVP | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **Developer Experience** | ✅ Low friction | ⚠️ Medium | ⚠️ Medium | ⚠️ Steep | ⚠️ Medium | ✅ Low friction |

---

## Pricing Comparison

### Scenario assumptions

These are illustrative estimates, not observed customer bills. Soonwhy scenarios assume the stated ingestion volume plus the storage, AI-analysis, and API-request volumes shown below. Competitor figures use the published pricing pages available when this document was updated and may not be directly comparable because billing meters differ.

### Startup Scenario (5 hosts, 10GB/month telemetry)

| Platform | Monthly Cost | Annual Cost |
|----------|--------------|-------------|
| **Soonwhy** | **$8.04** | **$96.48** |
| Datadog | $90 (5 × $18) | $1,080 |
| SigNoz Cloud | $49 + $3 = $52 | $624 |
| Grafana Cloud | $19 + usage ≈ $30 | $360 |
| New Relic | $0 (within free tier) | $0 |
| Tinybird | $49 | $588 |

### Scale-Up Scenario (50 hosts, 100GB/month telemetry)

| Platform | Monthly Cost | Annual Cost |
|----------|--------------|-------------|
| **Soonwhy** | **$80.40** | **$964.80** |
| Datadog | $900 + APM $1,550 = $2,450 | $29,400 |
| SigNoz Cloud | $49 + $30 = $79 | $948 |
| Grafana Cloud | $19 + usage ≈ $200 | $2,400 |
| New Relic | $349 × 5 = $1,745 | $20,940 |
| Tinybird | Custom | Custom |

### Enterprise Scenario (200 hosts, 1TB/month telemetry)

| Platform | Monthly Cost | Annual Cost |
|----------|--------------|-------------|
| **Soonwhy** | **$699.00** | **$8,388.00** |
| Datadog | $3,600 + APM $6,200 = $9,800 | $117,600 |
| SigNoz Cloud | $4,000 minimum | $48,000 |
| Grafana Cloud | $25,000 minimum | $25,000 |
| New Relic | $111,480 median | $111,480 |
| Tinybird | Custom | Custom |

---

## Soonwhy's Differentiators

### 1. Evidence-Gated AI

Every AI conclusion cites specific telemetry data:

```
❌ "High latency detected on /api/users"
✅ "P95 latency increased from 120ms to 890ms after deployment abc123.
    Root cause: PostgreSQL query on users table increased from 5ms to 450ms
    (evidence: span id=abc123, trace id=def456)"
```

This prevents hallucinated root causes and teaches developers reasoning.

### 2. SDK-First Integration

No agents to install, no magic configuration:

```typescript
import { Soonwhy } from '@soonwhy/sdk';

const sdk = new Soonwhy({
  apiKey: process.env.SOONWHY_API_KEY,
});

sdk.instrument(app); // Auto-instruments HTTP, DB, etc.
```

5 minutes to first telemetry, not 5 days.

### 3. Self-Hosted by Default

Run on your own infrastructure:

```bash
docker-compose up -d
```

- ClickHouse in your VPC (hot storage)
- R2 in your account (cold storage)
- No data leaves your network

### 4. Pure Pay-As-You-Go

No per-host fees, no seat licenses, no minimums:

| Metric | Price |
|--------|-------|
| Ingestion | $0.50/GB |
| Storage | $0.02/GB/month |
| AI Analysis | $0.10/analysis |
| API Requests | $0.10/10K requests |

### 5. Cold Storage Architecture

- Hot: ClickHouse (0-7 days, fast queries)
- Cold: R2 + Parquet (7+ days, 10x cheaper)
- Automatic lifecycle management
- Query cold data when needed

---

## Market Positioning

```
                    AI-Powered
                        ↑
                        |
          Soonwhy ●     |
                        |
    Evidence-Gated      |
                        |
←───────────────────────┼───────────────────────→
  Self-Hosted           |           SaaS-Only
                        |
                        |
          SigNoz ●      |      ● Datadog
          Grafana ●     |      ● New Relic
                        |
                        ↓
                    Basic Monitoring
```

**Soonwhy's Position:** AI-powered, self-hosted, evidence-gated observability

---

## Source Notes

Competitor pricing and capabilities should be rechecked before publication. Current reference points: Datadog pricing, SigNoz pricing, Grafana Cloud pricing, New Relic pricing, and Tinybird pricing. Retrieved September 2026.

## Competitive Advantages

1. **Trust through evidence** — Every AI claim has data backing it
2. **Cost transparency** — Pay for what you use, no surprises
3. **Data sovereignty** — Self-hosted by default
4. **Developer experience** — SDK-first, not agent-based
5. **Storage innovation** — Hot/cold lifecycle with R2+Parquet

## Competitive Risks

1. **Datadog's brand** — Strong market recognition
2. **SigNoz's community** — Active open-source ecosystem
3. **Grafana's dashboards** — Superior visualization
4. **New Relic's free tier** — 100GB/month is generous

## Mitigation Strategies

1. **Educate on evidence-gated AI** — Show why trust matters
2. **Build community** — Open-source SDK, contribute to OTel
3. **Partner with Grafana** — Export to Grafana dashboards
4. **Offer better free tier** — 1GB/month with no time limit
