# Soonwhy — Pricing Model

## Pricing Philosophy

Soonwhy uses paid-first pricing with a 7-day trial. Paid plans include a predictable allowance for telemetry and AI usage, with transparent overage rates. There are no per-host fees and no seat-based platform charge.

## Pricing Rates

### Telemetry Ingestion

| Metric | Price | Notes |
|--------|-------|-------|
| **Log ingestion** | $0.50/GB | Structured JSON logs |
| **Metric ingestion** | $0.50/GB | Time series data |
| **Trace ingestion** | $0.50/GB | Distributed traces |
| **Request ingestion** | $0.50/GB | HTTP request/response pairs |
| **Error ingestion** | $0.50/GB | Error events with stack traces |

**Volume Discounts**

| Monthly Volume | Discount |
|----------------|----------|
| 0-100 GB | $0.50/GB |
| 100-500 GB | $0.45/GB (10% off) |
| 500 GB - 1 TB | $0.40/GB (20% off) |
| 1-5 TB | $0.35/GB (30% off) |
| 5+ TB | Custom pricing |

### Data Storage

| Tier | Price | Retention | Query Speed |
|------|-------|-----------|-------------|
| **Hot storage (ClickHouse)** | $0.02/GB/month | 0-7 days | Fast (ms) |
| **Cold storage (R2 + Parquet)** | $0.005/GB/month | 7-90 days | Medium (seconds) |
| **Archive storage** | $0.001/GB/month | 90+ days | Slow (minutes) |

**Storage Calculation**

```
Monthly storage cost = (Hot GB × $0.02) + (Cold GB × $0.005) + (Archive GB × $0.001)
```

### AI Analysis

| Analysis Type | Price | Notes |
|---------------|-------|-------|
| **Anomaly detection** | $0.10/analysis | Automatic pattern detection |
| **Root cause analysis** | $0.10/analysis | Evidence-backed explanation |
| **Correlation analysis** | $0.10/analysis | Cross-signal correlation |
| **Health score computation** | $0.01/computation | Composite metric |

**Volume Discounts**

| Monthly Analyses | Discount |
|------------------|----------|
| 0-1,000 | $0.10/analysis |
| 1,000-10,000 | $0.09/analysis (10% off) |
| 10,000-100,000 | $0.08/analysis (20% off) |
| 100,000+ | Custom pricing |

### API Requests

| Request Type | Price | Notes |
|--------------|-------|-------|
| **Ingestion API** | $0.10/10K requests | Telemetry submission |
| **Query API** | $0.10/10K requests | Data retrieval |
| **Management API** | $0.10/10K requests | Configuration |

**Volume Discounts**

| Monthly Requests | Discount |
|------------------|----------|
| 0-1M | $0.10/10K |
| 1-10M | $0.09/10K (10% off) |
| 10-100M | $0.08/10K (20% off) |
| 100M+ | Custom pricing |

---

## 7-Day Trial

### What's Included

| Metric | Limit | Notes |
|--------|-------|-------|
| **Ingestion** | Trial allowance | All telemetry types |
| **Storage** | Trial allowance | Hot storage only |
| **AI Analysis** | Trial allowance | All analysis types |
| **API Requests** | Trial allowance | All API types |
| **Retention** | 7 days | Hot storage only |
| **Projects** | 1 | Single project |
| **Environments** | 2 | Production + Staging |
| **Team Members** | 3 | Basic access |

### Free Tier Rules

- Trial lasts 7 days
- Trial converts to a selected paid plan after the trial period
- Usage beyond the included allowance is billed at the published overage rate
- Billing is blocked until a payment method is available
- Trial data is retained according to the selected plan's retention policy

---

## Usage Metering

### What to Track

| Metric | Unit | Aggregation | Billing Period |
|--------|------|-------------|----------------|
| **Ingestion volume** | GB | Sum per project | Monthly |
| **Storage volume** | GB | Average per day | Monthly |
| **AI analyses** | Count | Sum per project | Monthly |
| **API requests** | Count | Sum per project | Monthly |

### Metering Requirements

1. **Real-time tracking** — Usage updated within 60 seconds of event
2. **Per-project isolation** — Each project metered separately
3. **Per-environment breakdown** — Production vs. staging vs. development
4. **Audit trail** — Every metered event logged for billing disputes
5. **Idempotency** — Duplicate events don't double-count

### Metering Architecture

```
SDK sends telemetry
    ↓
API receives request
    ↓
Metering service increments counters
    ↓
Counters stored in Redis (real-time)
    ↓
Counters flushed to ClickHouse (hourly)
    ↓
Billing service calculates costs
    ↓
Invoice generated at month end
```

### Metering API

```typescript
// Metering event structure
interface MeteringEvent {
  id: string;           // UUID, idempotency key
  org_id: string;       // Organization ID
  project_id: string;   // Project ID
  environment_id: string; // Environment ID
  timestamp: Date;      // Event time
  type: 'ingestion' | 'storage' | 'analysis' | 'api_request';
  quantity: number;     // GB, count, etc.
  metadata?: Record<string, any>; // Additional context
}
```

---

## Billing Flow

### Stripe Integration

1. **Customer creation** — Create Stripe customer on org signup
2. **Subscription management** — Handle plan changes, upgrades, downgrades
3. **Invoice generation** — Monthly invoices with usage breakdown
4. **Payment processing** — Automatic payment collection
5. **Dunning management** — Handle failed payments

### Billing Cycle

| Event | Timing | Action |
|-------|--------|--------|
| **Usage recording** | Real-time | Increment counters |
| **Invoice preview** | 5 days before month end | Estimate costs |
| **Invoice generation** | 1st of month | Finalize invoice |
| **Payment collection** | 3rd of month | Charge card |
| **Dunning start** | 7th of month | Retry failed payment |
| **Dunning end** | 14th of month | Suspend account |

### Invoice Structure

```json
{
  "invoice_id": "inv_abc123",
  "org_id": "org_xyz789",
  "period_start": "2026-08-01",
  "period_end": "2026-08-31",
  "line_items": [
    {
      "description": "Log ingestion (Production)",
      "quantity": 45.2,
      "unit": "GB",
      "rate": 0.50,
      "amount": 22.60
    },
    {
      "description": "Hot storage",
      "quantity": 12.5,
      "unit": "GB",
      "rate": 0.02,
      "amount": 0.25
    },
    {
      "description": "AI root cause analysis",
      "quantity": 150,
      "unit": "analyses",
      "rate": 0.10,
      "amount": 15.00
    }
  ],
  "subtotal": 37.85,
  "discount": 0,
  "total": 37.85,
  "currency": "USD"
}
```

---

## Usage Dashboard

### Real-Time Cost Tracking

**Dashboard Components**

1. **Current Month Usage** — Breakdown by metric type
2. **Cost Projection** — Estimated month-end cost based on current usage
3. **Usage Trends** — Daily/weekly/monthly usage charts
4. **Project Breakdown** — Cost per project
5. **Environment Breakdown** — Cost per environment

### Dashboard Metrics

| Metric | Display | Update Frequency |
|--------|---------|------------------|
| **Ingestion volume** | GB (current month) | Real-time |
| **Storage volume** | GB (current) | Real-time |
| **AI analyses** | Count (current month) | Real-time |
| **API requests** | Count (current month) | Real-time |
| **Current cost** | $ (current month) | Real-time |
| **Projected cost** | $ (estimated month-end) | Hourly |

### Cost Breakdown Chart

```
Current Month: $47.85
├── Ingestion: $35.00 (73%)
│   ├── Logs: $22.60 (47%)
│   ├── Metrics: $8.40 (18%)
│   └── Traces: $4.00 (8%)
├── Storage: $5.25 (11%)
│   ├── Hot: $2.50 (5%)
│   └── Cold: $2.75 (6%)
├── AI Analysis: $6.00 (13%)
│   ├── Root cause: $4.50 (9%)
│   └── Anomaly: $1.50 (3%)
└── API Requests: $1.60 (3%)
    ├── Ingestion: $1.20 (3%)
    └── Query: $0.40 (1%)
```

---

## Hard Spending Caps

### Cap Configuration

| Cap Type | Default | Configurable | Action |
|----------|---------|--------------|--------|
| **Monthly ingestion** | $1,000 | Yes | Stop ingesting, alert team |
| **Monthly storage** | $500 | Yes | Archive old data, alert team |
| **Monthly AI analysis** | $200 | Yes | Disable AI, alert team |
| **Monthly API requests** | $100 | Yes | Rate limit, alert team |

### Cap Actions

When a cap is reached:

1. **Ingestion cap** — Stop accepting new telemetry, return 429 status
2. **Storage cap** — Archive oldest data to cold storage
3. **AI analysis cap** — Disable AI features, return cached results
4. **API request cap** — Rate limit to 10 req/sec, return 429 status

### Cap Override

```typescript
// Cap override configuration
interface SpendingCap {
  org_id: string;
  cap_type: 'ingestion' | 'storage' | 'analysis' | 'api_requests';
  monthly_limit: number; // In dollars
  action: 'alert' | 'throttle' | 'stop';
  alert_thresholds: number[]; // [0.5, 0.8, 1.0] for 50%, 80%, 100%
  override_until?: Date; // Temporary override for high-traffic periods
}
```

---

## Usage Alerts

### Alert Thresholds

| Threshold | Default | Configurable | Alert Type |
|-----------|---------|--------------|------------|
| **50% of budget** | Yes | Yes | Email + Dashboard |
| **80% of budget** | Yes | Yes | Email + Dashboard + Slack |
| **100% of budget** | Yes | Yes | Email + Dashboard + Slack + SMS |
| **Anomalous usage** | Yes | Yes | Email + Dashboard |

### Alert Configuration

```typescript
// Alert configuration
interface UsageAlert {
  org_id: string;
  threshold: number; // 0.5, 0.8, 1.0
  channels: ('email' | 'slack' | 'sms' | 'dashboard')[];
  recipients: string[]; // Email addresses, phone numbers
  slack_webhook?: string;
  enabled: boolean;
}
```

### Alert Examples

**50% Budget Alert**
```
Subject: Soonwhy Usage Alert - 50% of Monthly Budget

You've used 50% of your monthly budget for August 2026.

Current usage:
- Ingestion: 25.0 GB ($12.50)
- Storage: 8.5 GB ($0.17)
- AI Analysis: 75 analyses ($7.50)
- API Requests: 50K requests ($0.50)

Total: $20.67 of $50.00 budget

Projected month-end cost: $41.34

To adjust your budget or spending caps, visit:
https://app.soonwhy.com/settings/billing
```

**100% Budget Alert**
```
Subject: Soonwhy Usage Alert - 100% of Monthly Budget

You've reached 100% of your monthly budget for August 2026.

Current usage:
- Ingestion: 67.5 GB ($33.75)
- Storage: 12.5 GB ($0.25)
- AI Analysis: 150 analyses ($15.00)
- API Requests: 100K requests ($1.00)

Total: $50.00 of $50.00 budget

Action taken:
- Ingestion: Throttled to 10 req/sec
- AI Analysis: Disabled
- API Requests: Rate limited

To increase your budget or remove caps, visit:
https://app.soonwhy.com/settings/billing
```

---

## Pricing Calculator

### Example Calculations

**Startup (5GB/month ingestion)**
```
Ingestion: 5 GB × $0.50 = $2.50
Storage: 2 GB × $0.02 = $0.04
AI Analysis: 50 × $0.10 = $5.00
API Requests: 50K × $0.10/10K = $0.50
Total: $8.04/month
```

**Scale-Up (50GB/month ingestion)**
```
Ingestion: 50 GB × $0.50 = $25.00
Storage: 20 GB × $0.02 = $0.40
AI Analysis: 500 × $0.10 = $50.00
API Requests: 500K × $0.10/10K = $5.00
Total: $80.40/month
```

**Enterprise (500GB/month ingestion)**
```
Ingestion: 500 GB × $0.40 = $200.00 (20% volume discount)
Storage: 200 GB × $0.02 = $4.00
AI Analysis: 5,000 × $0.09 = $450.00 (10% volume discount)
API Requests: 5M × $0.09/10K = $45.00 (10% volume discount)
Total: $699.00/month
```

---

## Implementation Requirements

### Phase 1: MVP (Weeks 1-8)

- [ ] Usage metering service
- [ ] Stripe customer creation
- [ ] Invoice generation
- [ ] Basic usage dashboard
- [ ] Hard spending caps
- [ ] Usage alerts (email only)

### Phase 2: Enhancement (Weeks 9-12)

- [ ] Volume discounts
- [ ] Slack/SMS alerts
- [ ] Cost projection
- [ ] Project/environment breakdown
- [ ] Billing API

### Phase 3: Enterprise (Weeks 13-16)

- [ ] Custom pricing
- [ ] Annual commitments
- [ ] Invoice customization
- [ ] Cost allocation
- [ ] Budget management

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Billing accuracy** | 99.9% | Disputes / total invoices |
| **Invoice delivery** | 100% on time | Invoices delivered by 1st of month |
| **Payment success** | >95% | Successful payments / total attempts |
| **Alert delivery** | <5 minutes | Time from threshold to alert |
| **Usage dashboard latency** | <60 seconds | Time from event to dashboard update |
