# Soonwhy — Pricing Model

## Pricing Philosophy

14-day free trial with full access. After trial, choose a plan based on team size and data volume. Usage-based overages with volume discounts ensure costs scale with customer success — not against it.

---

## Trial

| Feature | Included |
|---------|----------|
| Duration | 14 days, no credit card required |
| Ingestion | 50 GB total (across all telemetry) |
| Storage | 25 GB hot storage |
| AI Analysis | 500 analyses |
| Projects | 3 |
| Environments | 3 per project |
| Team Members | 5 |
| All features | Enabled |

Trial ends automatically. Customer must select a plan or data is retained for 30 days then deleted.

---

## Plans

### Starter — $19/month

**For:** Indie hackers, solo devs, side projects

| Feature | Included |
|---------|----------|
| Ingestion | 15 GB/month |
| Hot storage | 15 GB |
| Cold storage | 50 GB |
| AI Analysis | 200/month |
| Projects | 3 |
| Environments | 3 per project |
| Team Members | 3 |
| Retention | 7 days hot, 90 days cold |
| Support | Community (GitHub Discussions) |

### Growth — $49/month

**For:** Small teams, production apps

| Feature | Included |
|---------|----------|
| Ingestion | 75 GB/month |
| Hot storage | 75 GB |
| Cold storage | 300 GB |
| AI Analysis | 1,000/month |
| Projects | 10 |
| Environments | 5 per project |
| Team Members | 10 |
| Retention | 14 days hot, 180 days cold |
| Support | Email |
| SSO | Included |

### Scale — $149/month

**For:** Growing companies, multiple services

| Feature | Included |
|---------|----------|
| Ingestion | 300 GB/month |
| Hot storage | 300 GB |
| Cold storage | 1 TB |
| AI Analysis | 5,000/month |
| Projects | Unlimited |
| Environments | 10 per project |
| Team Members | 30 |
| Retention | 30 days hot, 365 days cold |
| Support | Priority email + chat |
| SSO | Included |
| RBAC | Included |
| Audit logs | Included |

### Enterprise — Custom

**For:** Large organizations, compliance requirements

| Feature | Included |
|---------|----------|
| Ingestion | Custom volume |
| Storage | Custom |
| AI Analysis | Custom |
| Retention | Custom |
| Support | Dedicated CSM + SLA |
| SSO (SAML) | Included |
| RBAC | Included |
| Audit logs | Included |
| Data residency | Region-locked |
| Invoice billing | Net-30 |
| On-prem option | Available |

Contact sales for pricing.

---

## Usage Overages

When usage exceeds plan limits, overages are billed at the rates below. Volume discounts apply automatically.

### Telemetry Ingestion

| Monthly Overage | Price per GB |
|----------------|-------------|
| 0 – 50 GB | $0.30 |
| 50 – 200 GB | $0.22 (27% off) |
| 200 GB – 1 TB | $0.15 (50% off) |
| 1 – 5 TB | $0.10 (67% off) |
| 5+ TB | Custom |

### Hot Storage (ClickHouse)

| Monthly Usage | Price per GB/month |
|--------------|-------------------|
| 0 – 50 GB | $0.03 |
| 50 – 200 GB | $0.025 |
| 200 GB+ | $0.02 |

### Cold Storage (R2 + Parquet)

| Monthly Usage | Price per GB/month |
|--------------|-------------------|
| 0 – 200 GB | $0.01 |
| 200 GB – 1 TB | $0.008 |
| 1 TB+ | $0.005 |

### AI Analysis

| Monthly Analyses | Price per Analysis |
|-----------------|-------------------|
| 0 – 500 | $0.15 |
| 500 – 5,000 | $0.10 (33% off) |
| 5,000 – 50,000 | $0.07 (53% off) |
| 50,000+ | Custom |

### API Requests

Included in plan limits. Overage only:

| Monthly Overage | Price per 10K Requests |
|----------------|----------------------|
| 0 – 500K | $0.05 |
| 500K – 5M | $0.03 |
| 5M+ | Custom |

---

## Enterprise Add-Ons

Available on Scale and Enterprise plans:

| Add-On | Price | Notes |
|--------|-------|-------|
| SSO (SAML) | Included in Scale+ | — |
| RBAC | Included in Scale+ | — |
| Audit logs | Included in Scale+ | — |
| Data residency | $200/month per region | EU, APAC, etc. |
| Dedicated cluster | $500/month | Isolated ClickHouse |
| Premium support | $300/month | 4-hour SLA |
| On-prem deployment | Custom | Self-hosted |

---

## Revenue Projections

### Cost Basis (per user segment)

| Segment | Monthly COGS | Price | Gross Margin |
|---------|-------------|-------|--------------|
| Indie (5 GB/mo) | ~$0.15 | $19 | 99% |
| Small team (40 GB/mo) | ~$1.50 | $49 | 97% |
| Growing (150 GB/mo) | ~$6.00 | $149 | 96% |
| Enterprise (1 TB/mo) | ~$25 | Custom | 90%+ |

### Per-Customer Economics

| Plan | Base MRR | Avg Overage | Total MRR | Gross Margin |
|------|----------|-------------|-----------|--------------|
| Starter | $19 | $5 | $24 | 99% |
| Growth | $49 | $20 | $69 | 97% |
| Scale | $149 | $60 | $209 | 96% |
| Enterprise | $1,000 | $300 | $1,300 | 90%+ |

---

## Pricing Calculator Examples

### Indie Hacker (3 GB/month ingestion)

**Starter plan:**
```
Base:                    $19.00
Ingestion (3 GB):        $0.00  (within 15 GB limit)
Storage (1 GB):          $0.00  (within 15 GB limit)
AI Analysis (20):        $0.00  (within 200 limit)
Total:                   $19.00/month
```

### Side Project (12 GB/month ingestion)

**Starter plan:**
```
Base:                    $19.00
Ingestion (12 GB):       $0.00  (within 15 GB limit)
Storage (5 GB):          $0.00  (within 15 GB limit)
AI Analysis (80):        $0.00  (within 200 limit)
Total:                   $19.00/month
```

### Growing Indie (25 GB/month ingestion)

**Starter plan with overages:**
```
Base:                    $19.00
Ingestion overage (10 GB): $3.00  (10 GB × $0.30)
Storage (8 GB):          $0.00  (within 15 GB limit)
AI Analysis (150):       $0.00  (within 200 limit)
Total:                   $22.00/month
```

### Small Team (60 GB/month ingestion)

**Growth plan:**
```
Base:                    $49.00
Ingestion (60 GB):       $0.00  (within 75 GB limit)
Storage (30 GB):         $0.00  (within 75 GB limit)
AI Analysis (600):       $0.00  (within 1,000 limit)
Total:                   $49.00/month
```

### Scaling Company (200 GB/month ingestion)

**Growth plan with overages:**
```
Base:                    $49.00
Ingestion overage (125 GB): $27.50  (125 GB × $0.22)
Storage (80 GB):         $0.00
AI Analysis (2,500):     $150.00  (1,500 × $0.10)
Total:                   $226.50/month
```

### High-Volume (800 GB/month ingestion)

**Scale plan:**
```
Base:                    $149.00
Ingestion (300 GB):      $0.00
Ingestion overage (500 GB): $75.00  (500 GB × $0.15)
Storage (200 GB):        $0.00
AI Analysis (8,000):     $210.00  (3,000 × $0.10 + 5,000 × $0.07)
Total:                   $434.00/month
```

---

## Why This Works for Indie Hackers

| Concern | How we address it |
|---------|-------------------|
| **"I can't afford $49/mo"** | Starter is $19/mo — less than Netflix + Spotify |
| **"I'll hit limits fast"** | 15 GB is generous for most side projects |
| **"Overages will surprise me"** | Hard spending caps + alerts at 80% and 100% |
| **"I'll outgrow Starter"** | Growth at $49 is a natural step when revenue comes |
| **"Enterprise features are locked"** | SSO included from Growth ($49), not gatekept |
| **"I'm just testing"** | 14-day trial, full access, no credit card |

### The Upgrade Path

```
Trial (14 days, free)
    ↓
Starter ($19/mo) — 15 GB included
    ↓ when you scale
Growth ($49/mo) — 75 GB included + SSO
    ↓ when you grow more
Scale ($149/mo) — 300 GB + RBAC + audit logs
    ↓ when you need custom
Enterprise (custom) — dedicated + SLA + data residency
```

Each step is 2.5-3x the previous, which feels natural as revenue grows.

---

## Success Metrics

| Metric | Target | Why |
|--------|--------|-----|
| Trial → Starter conversion | >20% | $19 is low friction |
| Starter → Growth upgrade | >30% within 12 mo | Natural growth trigger |
| Monthly logo churn | <5% | Healthy for indie-friendly pricing |
| Net revenue retention | >110% | Overages + upgrades outpace churn |
| Gross margin | >90% | Infrastructure costs are low |
| Time to first value (trial) | <10 min | SDK install → first telemetry |

---

## Implementation Phases

### Phase 1: MVP (Weeks 1-8)
- [ ] Usage metering service
- [ ] Stripe customer + subscription creation
- [ ] Invoice generation
- [ ] Basic usage dashboard
- [ ] Hard spending caps
- [ ] Email usage alerts

### Phase 2: Growth (Weeks 9-12)
- [ ] Volume discounts (automatic)
- [ ] Overage billing
- [ ] Cost projection dashboard
- [ ] Project/environment cost breakdown
- [ ] Slack/SMS alerts

### Phase 3: Enterprise (Weeks 13-16)
- [ ] Custom pricing support
- [ ] Annual commitments
- [ ] Invoice customization (Net-30)
- [ ] Cost allocation / budget management
- [ ] SSO/RBAC/audit log add-ons
