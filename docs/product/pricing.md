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

### Starter — $49/month

**For:** Small teams, side projects, early-stage startups

| Feature | Included |
|---------|----------|
| Ingestion | 25 GB/month |
| Hot storage | 25 GB |
| Cold storage | 100 GB |
| AI Analysis | 500/month |
| Projects | 5 |
| Environments | 3 per project |
| Team Members | 5 |
| Retention | 14 days hot, 90 days cold |
| Support | Email |

### Growth — $149/month

**For:** Growing teams, production workloads

| Feature | Included |
|---------|----------|
| Ingestion | 100 GB/month |
| Hot storage | 100 GB |
| Cold storage | 500 GB |
| AI Analysis | 2,000/month |
| Projects | 20 |
| Environments | 5 per project |
| Team Members | 20 |
| Retention | 30 days hot, 180 days cold |
| Support | Email + chat |
| SSO | Included |

### Scale — $499/month

**For:** Scaling companies, multiple services

| Feature | Included |
|---------|----------|
| Ingestion | 500 GB/month |
| Hot storage | 500 GB |
| Cold storage | 2 TB |
| AI Analysis | 10,000/month |
| Projects | Unlimited |
| Environments | 10 per project |
| Team Members | 50 |
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
| 0 – 100 GB | $0.30 |
| 100 – 500 GB | $0.25 (17% off) |
| 500 GB – 1 TB | $0.20 (33% off) |
| 1 – 5 TB | $0.15 (50% off) |
| 5+ TB | Custom |

### Hot Storage (ClickHouse)

| Monthly Usage | Price per GB/month |
|--------------|-------------------|
| 0 – 100 GB | $0.03 |
| 100 – 500 GB | $0.025 |
| 500 GB+ | $0.02 |

### Cold Storage (R2 + Parquet)

| Monthly Usage | Price per GB/month |
|--------------|-------------------|
| 0 – 500 GB | $0.01 |
| 500 GB – 2 TB | $0.008 |
| 2 TB+ | $0.005 |

### AI Analysis

| Monthly Analyses | Price per Analysis |
|-----------------|-------------------|
| 0 – 1,000 | $0.15 |
| 1,000 – 10,000 | $0.12 (20% off) |
| 10,000 – 100,000 | $0.08 (47% off) |
| 100,000+ | Custom |

### API Requests

Included in plan limits. Overage only:

| Monthly Overage | Price per 10K Requests |
|----------------|----------------------|
| 0 – 1M | $0.05 |
| 1 – 10M | $0.04 |
| 10M+ | Custom |

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

### Model Assumptions

| Metric | Value |
|--------|-------|
| Trial → Paid conversion | 15% |
| Monthly churn | 3% |
| Average plan | Growth ($149) |
| Average overage | $50/month |
| Enterprise ACV | $12,000 |

### Per-Customer Economics

| Plan | Base MRR | Avg Overage | Total MRR | Gross Margin |
|------|----------|-------------|-----------|--------------|
| Starter | $49 | $15 | $64 | 75% |
| Growth | $149 | $50 | $199 | 78% |
| Scale | $499 | $150 | $649 | 80% |
| Enterprise | $1,000 | $300 | $1,300 | 82% |

### Cost Basis (per GB ingested)

| Component | Cost |
|-----------|------|
| ClickHouse (hot) | ~$0.008/GB/month |
| R2 (cold) | ~$0.005/GB/month |
| NATS processing | ~$0.002/GB |
| LLM API (per analysis) | ~$0.03-0.08 |
| **Total COGS per GB** | **~$0.015** |
| **Ingestion price** | **$0.15-0.30** |
| **Gross margin** | **90-95%** |

---

## Billing Implementation

### Stripe Integration

1. Customer creation on org signup (trial starts automatically)
2. Subscription creation when plan selected
3. Usage metering via Stripe Billing Meters
4. Invoice generation at month end
5. Automatic payment collection
6. Dunning: retry at +3, +7, +14 days; suspend at +21

### Metering

| Metric | Unit | Aggregation | Billing |
|--------|------|-------------|---------|
| Ingestion | GB | Sum per org | Monthly |
| Storage | GB | Daily average | Monthly |
| AI analyses | Count | Sum per org | Monthly |
| API requests | Count | Sum per org | Monthly |

### Usage Dashboard

Real-time dashboard showing:
- Current month usage by type
- Projected month-end cost
- Cost breakdown by project/environment
- Usage trends (daily/weekly)
- Overage warnings at 80% and 100% of plan limits

### Hard Caps

Orgs can set spending caps. When reached:
- Ingestion: return 429, stop accepting telemetry
- AI: disable analysis features, return cached results
- API: rate limit to 10 req/sec

---

## Pricing Calculator Examples

### Startup (5 GB/month ingestion)

**Starter plan:**
```
Base:                    $49.00
Ingestion (5 GB):        $0.00  (included)
Storage (2 GB):          $0.00  (included)
AI Analysis (50):        $0.00  (included)
Total:                   $49.00/month
```

### Growing App (40 GB/month ingestion)

**Growth plan:**
```
Base:                    $149.00
Ingestion overage (40 GB): $0.00  (within 100 GB limit)
Storage (30 GB):          $0.00  (within 100 GB limit)
AI Analysis (800):        $0.00  (within 2,000 limit)
Total:                   $149.00/month
```

### Scaling Company (200 GB/month ingestion)

**Growth plan with overages:**
```
Base:                    $149.00
Ingestion overage (100 GB): $30.00  (100 GB × $0.30)
Storage (80 GB):          $0.00
AI Analysis (3,000):      $120.00  (1,000 × $0.12 + 1,000 × $0.12... wait, 3000-2000 = 1000 overage at $0.15)
AI overage (1,000):       $15.00
Total:                   $194.00/month
```

### High-Volume (1 TB/month ingestion)

**Scale plan:**
```
Base:                    $499.00
Ingestion (included):     $0.00
Ingestion overage (500 GB): $100.00  (500 GB × $0.20)
Storage (200 GB):         $0.00
AI Analysis (15,000):     $400.00  (5,000 included + 5,000 × $0.12 + 5,000 × $0.08)
Total:                   $999.00/month
```

---

## Success Metrics

| Metric | Target | Why |
|--------|--------|-----|
| Trial → Paid conversion | >15% | Industry avg 10-20% for dev tools |
| Monthly logo churn | <3% | Healthy SaaS benchmark |
| Net revenue retention | >110% | Overages + upgrades outpace churn |
| Average revenue per org | >$150 | Growth plan + overages |
| Gross margin | >75% | Infrastructure + LLM costs |
| Time to first value (trial) | <10 min | SDK install → first telemetry |
| Billing accuracy | 99.9% | Disputes / total invoices |

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
