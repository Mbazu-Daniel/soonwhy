# Soonwhy — Product Vision & Personas

## Vision

Soonwhy is an AI-powered observability platform that helps developers understand why their applications break, not just when. We combine telemetry collection, intelligent analysis, and evidence-backed insights to reduce mean time to resolution from hours to minutes.

## Product Principles

1. **Evidence over opinions** — Every AI conclusion must cite specific telemetry data. No hallucinated root causes.

2. **Pay for what you use** — Pure consumption-based pricing. No seat licenses, no minimum commitments, no surprise bills.

3. **Self-hosted by default** — Run on your own infrastructure. Your data stays in your VPC. We provide the software, you own the stack.

4. **Developer-first** — Built by developers, for developers. SDK-first integration, not agent-based magic that breaks.

5. **Progressive disclosure** — Start with basic telemetry, add AI analysis when you're ready. Don't force complexity.

## Target Personas

### Persona 1: Solo Founder / Early-Stage CTO

**Demographics**
- 1-5 person startup
- Technical founder or first engineering hire
- Budget-constrained, time-constrained
- Building MVP or scaling from 0→1

**Goals**
- Keep the app running without a dedicated DevOps team
- Understand production issues quickly
- Avoid expensive observability bills before revenue

**Pain Points**
- Datadog is too expensive at startup pricing
- Open-source solutions (Prometheus + Grafana) require too much setup
- Can't justify a full observability stack before product-market fit

**Jobs-To-Be-Done**
1. When my app goes down at 2am, I want to know why within 5 minutes, so I can fix it before users notice.
2. When I deploy a new feature, I want to see if error rates changed, so I can roll back quickly.
3. When an investor asks about reliability, I want to show uptime metrics, so I can demonstrate operational maturity.

**How Soonwhy Fits**
- Free tier covers early-stage usage
- SDK integration takes 5 minutes, not 5 days
- AI analysis compensates for lack of dedicated DevOps
- Pay-as-you-go scales with revenue

---

### Persona 2: Mid-Stage Engineering Lead

**Demographics**
- 10-50 person engineering team
- Managing 2-5 microservices
- Growing fast, adding engineers weekly
- Budget for tools, but needs to justify ROI

**Goals**
- Reduce mean time to resolution (MTTR)
- Onboard new engineers to production debugging
- Standardize observability across services

**Pain Points**
- Different teams use different logging formats
- Alert fatigue from too many noisy alerts
- Junior engineers don't know how to debug production issues

**Jobs-To-Be-Done**
1. When a new engineer joins, I want them to understand our system's health in their first week, so they can contribute to on-call rotation.
2. When multiple services have issues, I want to see the correlation, so I can identify the root cause.
3. When I need to justify observability spend, I want to show reduced MTTR, so I can prove ROI.

**How Soonwhy Fits**
- AI-powered correlation across services
- Evidence-gated responses teach junior engineers reasoning
- Usage-based pricing scales with team size
- Standardized SDK enforces consistent telemetry

---

### Persona 3: Platform Engineer at Scale-Up

**Demographics**
- 50-200 person company
- Managing infrastructure for multiple teams
- Self-hosted infrastructure preference
- Compliance requirements (SOC2, HIPAA)

**Goals**
- Keep data within company infrastructure
- Enforce observability standards across teams
- Reduce observability costs at scale

**Pain Points**
- SaaS observability vendors require sending data outside the network
- Self-hosted solutions lack AI-powered analysis
- Costs explode as telemetry volume grows

**Jobs-To-Be-Done**
1. When compliance requires data residency, I want to self-host observability, so we pass audits.
2. When telemetry volume grows, I want costs to scale linearly, so I can predict budgets.
3. When teams generate inconsistent telemetry, I want automated standards enforcement, so I maintain quality.

**How Soonwhy Fits**
- Self-hosted on Dokploy (Docker Compose)
- Hot storage in self-hosted ClickHouse (no data leaves VPC)
- Cold storage in R2 (you control the bucket)
- SDK enforces telemetry standards automatically

---

## How It All Fits Together

```
Developer writes code
    ↓
SDK instruments code (automatic + manual)
    ↓
Telemetry flows to Soonwhy API
    ↓
API validates, enriches, stores
    ↓
ClickHouse (hot) ← immediate queries
    ↓
R2 + Parquet (cold) ← long-term retention
    ↓
AI Engine analyzes patterns
    ↓
Mission Control displays insights
    ↓
Developer understands what happened and why
```

## Success Metrics

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Time to first insight | < 5 minutes | Developer gets value immediately |
| MTTR reduction | 50%+ vs. no observability | Core value proposition |
| Integration time | < 30 minutes | Low barrier to adoption |
| Cost predictability | Linear with volume | No surprise bills |
| AI accuracy | > 80% correct root causes | Trust in the product |

## Competitive Position

| Feature | Soonwhy | Datadog | SigNoz | Grafana |
|---------|---------|---------|--------|---------|
| AI root cause analysis | Evidence-gated | Generic suggestions | None | None |
| Self-hosted option | Yes (Docker) | No | Yes | Yes |
| Pricing | Pay-as-you-go | Per-host + per-GB | Self-hosted free | Self-hosted free |
| Telemetry standard | SDK-first | Agent-based | Agent-based | Agent-based |
| Learning curve | Low | Medium | High | High |
