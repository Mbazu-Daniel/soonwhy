# AI Evidence Gating Model

Every AI response in Soonwhy is gated on telemetry evidence. No claim is allowed without a citation to real data. This document defines the model.

## Evidence

Evidence is a discrete telemetry data point extracted during a query. An evidence item must contain:

| Field | Description |
|-------|-------------|
| `signal` | The signal type: log, metric, trace, request |
| `source` | The entity it came from (project, service, endpoint) |
| `timestamp` | When the event occurred |
| `value` | The numeric or string payload |
| `queryId` | The specific query that returned this item |

Evidence is only valid if it was returned by a query executed against live telemetry. Invented, inferred, or extrapolated data is never evidence.

### Evidence Types

- **Latency spike**: P95/P99 latency exceeds baseline by a configurable threshold.
- **Error increase**: Error rate (5xx) rises above a rolling window average.
- **Deployment correlation**: A deployment event timestamp aligns with anomaly onset.
- **Throughput shift**: Request volume drops or spikes outside normal range.
- **Trace bottleneck**: A single span accounts for disproportionate request duration.

## Confidence Scoring

Each AI response receives a confidence score on a `0-1` scale. The score is computed from:

1. **Evidence volume**: More independent evidence items raise confidence.
2. **Evidence agreement**: Consistent signals across log, metric, and trace raise confidence.
3. **Recency**: Evidence closer to the anomaly raises confidence.
4. **Source coverage**: Evidence from multiple services raises confidence.

### Threshold

The threshold is **0.7**. Responses scoring below this threshold use the low-confidence fallback.

```
if confidence < 0.7:
    respond with fallback template
else:
    respond with evidence-backed conclusion
```

The ADR recommends starting at 0.8 and lowering as the system proves reliable. The current value is 0.7.

## Evidence Extraction Pipeline

Evidence is extracted from raw telemetry in a deterministic pipeline:

```
Telemetry Store (ClickHouse)
        │
        ▼
   Query Executor
        │
        ▼
  Evidence Extractor
        │
        ▼
   Evidence Set ← [evidence items]
        │
        ▼
  Confidence Scorer
        │
        ▼
  Prompt Builder
        │
        ▼
      LLM
```

### Evidence Extractor

The extractor runs pre-defined query templates against telemetry:

1. **Latency query**: `SELECT p95(request.latency) WHERE timestamp > now() - INTERVAL 1 HOUR GROUP BY service`
2. **Error query**: `SELECT count(*) WHERE status >= 500 GROUP BY endpoint`
3. **Deployment query**: `SELECT timestamp, version FROM deployments WHERE timestamp BETWEEN anomaly_start AND anomaly_end`
4. **Trace query**: `SELECT span.name, span.duration FROM traces WHERE trace_id IN anomalous_traces ORDER BY span.duration DESC`

Each query returns a list of evidence items. The extractor normalizes results into the evidence schema.

## Prompt Engineering

The LLM prompt is constructed deterministically from the evidence set.

### System Prompt Template

```
You are a root-cause analysis engine. You have access to telemetry evidence.
You may ONLY reference evidence items provided in the evidence set.
If the evidence set is empty or insufficient, state that you cannot determine root cause.
Never invent data points, timestamps, or metrics.
Never assume causation without temporal correlation in the evidence.

For each claim, cite the evidence item by ID.
```

### User Prompt Structure

```
## Incident
- Anomaly: {anomaly_type}
- Time window: {start} to {end}
- Service: {service}

## Evidence
{evidence_items as structured list}

## Task
Identify the root cause. Cite evidence for every claim.
```

### Evidence Citation Format

Every claim in the response must include a citation:

```
The API latency spiked to 2.3s at 14:02 (evidence: E1).
This coincided with deployment v2.4.1 (evidence: E3).
```

The evidence ID (`E1`, `E2`, ...) maps directly to the evidence set. If a claim has no matching evidence ID, it is invalid.

## Hallucination Prevention

Prevention operates at four layers:

### 1. Prompt Lockdown

The system prompt explicitly forbids inventing data. The LLM is instructed to refuse or defer when evidence is absent.

### 2. Output Validation

A post-generation validator checks:

- Every evidence ID cited in the response exists in the evidence set.
- No numeric claim (latency, error rate, timestamp) appears in the response without a matching evidence item.
- Claims use hedging language ("the data suggests", "evidence indicates") rather than certainty ("this caused", "the problem is").

### 3. Confidence Gate

If the scorer returns confidence < 0.7, the response is replaced with the fallback template before it reaches the user. The LLM output is discarded.

### 4. Audit Logging

Every response is logged with input query, evidence set, model, confidence, and latency. This allows post-hoc review of any suspicious response.

## Audit Trail

Every AI response is persisted as an `AiAuditLog` entry:

```typescript
interface AiAuditLog {
  id: string;
  queryId: string;
  inputQuery: string;
  evidenceItems: EvidenceItem[];
  model: string;          // e.g. "gpt-4o", "claude-sonnet"
  confidenceScore: number;
  response: string;
  latencyMs: number;
  timestamp: Date;
  fallbackTriggered: boolean;
}
```

Audit logs are stored in the same ClickHouse instance as telemetry for fast querying. Retention follows the hot/cold storage lifecycle.

## Fallback (Confidence < 0.7)

When the confidence score falls below 0.7, the user receives a structured fallback response:

```
I see anomalies but can't determine root cause with confidence. Here's what I found:

- Latency increased on service "api" during the time window (evidence: E1).
- Error rate rose to 4.2% on endpoint /users (evidence: E2).

I need more data to identify a root cause. Consider:
- Adding more service logs
- Checking deployment history
- Reviewing recent infrastructure changes
```

The fallback:
- Lists the evidence that was found (never invents missing evidence).
- Suggests next steps the user can take.
- Logs the fallback event for later analysis.

Fallback responses are tracked as a metric. A high fallback rate signals insufficient telemetry coverage or a confidence threshold that is too aggressive.

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `CONFIDENCE_THRESHOLD` | `0.7` | Minimum score for an evidence-backed response |
| `EVIDENCE_LOOKBACK_MINUTES` | `60` | How far back to query telemetry |
| `MIN_EVIDENCE_ITEMS` | `2` | Minimum evidence items before the scorer runs |
| `MAX_PROMPT_EVIDENCE` | `20` | Maximum evidence items included in the prompt |
| `AUDIT_LOG_RETENTION_DAYS` | `90` | How long audit logs are retained |
