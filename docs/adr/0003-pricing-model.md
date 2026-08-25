# ADR-0003: Tiered Pricing with Usage Overages

## Status

Accepted (revised v2)

## Context

The original pure pay-as-you-go model ($0.50/GB flat rate, no tiers) was uncompetitive. The first revision ($49/mo Starter) was still too expensive for indie hackers, who are the core adoption channel for developer tools.

Key insight: Indie hackers with 1-5 GB/month telemetry cost ~$0.15/month in COGS. Even at $19/month, the gross margin is 99%. There's no reason to charge $49 when $19 captures the same segment with less friction.

## Decision

Adopt a tiered plan model with 14-day trial and usage-based overages:

| Plan | Price | Ingestion | AI Analyses | Target |
|------|-------|-----------|-------------|--------|
| Trial | $0 (14 days) | 50 GB total | 500 total | Try before buy |
| Starter | $19/mo | 15 GB/mo | 200/mo | Indie hackers, side projects |
| Growth | $49/mo | 75 GB/mo | 1,000/mo | Small teams, production |
| Scale | $149/mo | 300 GB/mo | 5,000/mo | Growing companies |
| Enterprise | Custom | Custom | Custom | Large orgs |

Overages billed at volume-discounted rates:
- Ingestion: $0.10-0.30/GB (vs $0.50 flat before)
- AI analysis: $0.07-0.15/analysis (vs $0.10 flat before)
- Storage: $0.005-0.03/GB/month

Enterprise add-ons: SSO, RBAC, audit logs, data residency, dedicated cluster, premium support.

## Consequences

### Positive
- $19/mo Starter is accessible for indie hackers (less than Netflix + Spotify)
- 99% gross margin on Starter ($19 price, $0.15 COGS)
- Volume discounts reward growth, not punish it
- Enterprise tier enables $10K+ ACV contracts
- 14-day trial reduces friction vs free tier
- 90%+ gross margins across all plans

### Negative
- $19/mo may attract users who never upgrade
- More complex billing (tiers + overages vs flat rate)
- Need Stripe Billing Meters for usage tracking

### Mitigation
- Usage dashboard with real-time cost tracking
- Hard spending caps to prevent surprise bills
- Alerts at 80% and 100% of plan limits
- Self-serve plan management (upgrade/downgrade)
- 14-day trial creates urgency without forever-free users

## Alternatives Considered

- **Pure PAYG (original):** Too expensive, no entry point, no volume incentives
- **Free tier + paid:** Attracts low-quality users, delays revenue, no trial expiration pressure
- **$49/mo Starter:** Too expensive for indie hackers, loses adoption channel
- **Per-seat pricing:** Doesn't align with value (more seats ≠ more data)
- **Per-host pricing:** Outdated, penalizes microservice architectures
- **Indie hacker application:** Adds friction, doesn't scale

## References

- [Sentry Pricing](https://sentry.io/pricing/) — Free → $26/mo → $80/mo
- [Axiom Pricing](https://axiom.co/pricing) — Free (500GB) → $25/mo + $0.12/GB
- [Better Stack Pricing](https://betterstack.com/pricing) — Free (3GB) → $29/mo
- [New Relic Pricing](https://newrelic.com/pricing) — Free (100GB) → $10/mo
