# ADR-0003: Tiered Pricing with Usage Overages

## Status

Accepted (revised)

## Context

The original pure pay-as-you-go model ($0.50/GB flat rate, no tiers) was uncompetitive:
- $0.50/GB is 4x more expensive than Axiom ($0.12/GB)
- No entry-level plan creates a cliff between trial and paid
- No volume discounts punish high-usage customers
- AI analysis at $0.10/analysis doesn't cover LLM API costs at scale
- Storage margins are too thin (~33% before ops)

## Decision

Adopt a tiered plan model with 14-day trial and usage-based overages:

| Plan | Price | Ingestion | AI Analyses | Target |
|------|-------|-----------|-------------|--------|
| Trial | $0 (14 days) | 50 GB total | 500 total | Try before buy |
| Starter | $49/mo | 25 GB/mo | 500/mo | Small teams |
| Growth | $149/mo | 100 GB/mo | 2,000/mo | Growing teams |
| Scale | $499/mo | 500 GB/mo | 10,000/mo | Scaling companies |
| Enterprise | Custom | Custom | Custom | Large orgs |

Overages billed at volume-discounted rates:
- Ingestion: $0.15-0.30/GB (vs $0.50 flat before)
- AI analysis: $0.08-0.15/analysis (vs $0.10 flat before)
- Storage: $0.005-0.03/GB/month

Enterprise add-ons: SSO, RBAC, audit logs, data residency, dedicated cluster, premium support.

## Consequences

### Positive
- Competitive pricing (ingestion 40-70% cheaper than before)
- Predictable base cost for customers (plan + known overage rates)
- Volume discounts reward growth, not punish it
- Enterprise tier enables $10K+ ACV contracts
- 14-day trial reduces friction vs free tier (no forever-free users)
- 75-82% gross margins across all plans

### Negative
- More complex billing (tiers + overages vs flat rate)
- Need Stripe Billing Meters for usage tracking
- Enterprise sales cycle longer than pure self-serve

### Mitigation
- Usage dashboard with real-time cost tracking
- Hard spending caps to prevent surprise bills
- Alerts at 80% and 100% of plan limits
- Self-serve plan management (upgrade/downgrade)

## Alternatives Considered

- **Pure PAYG (original):** Too expensive, no entry point, no volume incentives
- **Free tier + paid:** Attracts low-quality users, delays revenue, no trial expiration pressure
- **Per-seat pricing:** Doesn't align with value (more seats ≠ more data)
- **Per-host pricing:** Outdated, penalizes microservice architectures

## References

- [Sentry Pricing](https://sentry.io/pricing/) — Free → $26/mo → $80/mo
- [Axiom Pricing](https://axiom.co/pricing) — Free (500GB) → $25/mo + $0.12/GB
- [Better Stack Pricing](https://betterstack.com/pricing) — Free (3GB) → $29/mo
- [New Relic Pricing](https://newrelic.com/pricing) — Free (100GB) → $10/mo
