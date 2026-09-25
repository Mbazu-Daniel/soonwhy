# ADR-0003: Pure Pay-As-You-Go Pricing

## Status

Accepted

## Context

Soonwhy needs a pricing model that works for indie hackers and scales with usage. The team wants to avoid free tiers and surprise bills.

## Decision

Use pure pay-as-you-go pricing like Cloudflare:

| Resource | Price |
|----------|-------|
| Telemetry ingestion | $0.50/GB |
| Data storage | $0.02/GB/month |
| AI analysis | $0.10/analysis |
| API requests | $0.10/10K requests |

No base fee, no tiers, no free tier. Usage dashboard shows current consumption.

## Consequences

### Positive
- No commitment required
- Scales to zero (no telemetry = no bill)
- Transparent pricing
- Easy to understand
- No sales overhead

### Negative
- Unpredictable bills for high-volume users
- Revenue harder to forecast
- May lose customers who prefer predictable costs

### Mitigation
- Provide usage dashboard with real-time cost tracking
- Send usage alerts at 50%, 80%, 100% of estimated monthly spend
- Allow hard spending caps (stop ingesting when limit reached)

## Alternatives Considered
- **Tiered pricing**: More predictable, but less flexible
- **Free tier + paid**: Common, but attracts low-quality users
- **Per-host pricing**: Standard for observability, but doesn't fit all use cases
