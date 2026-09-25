# ADR-0004: AI Evidence-Gated Responses

## Status

Accepted

## Context

Soonwhy's core value is AI root-cause analysis. If the AI hallucinates or makes claims not backed by telemetry, it destroys user trust.

## Decision

All AI responses must be evidence-gated:

1. **Evidence requirement**: AI can only reference data that was actually queried and returned
2. **Confidence threshold**: If confidence < 0.7, respond with "I see anomalies but can't determine root cause with confidence. Here's what I found:"
3. **Audit trail**: Every AI response logs input query, evidence used, model used, confidence score, and latency

## Consequences

### Positive
- High trust in AI responses
- Clear audit trail for debugging
- Users know exactly what evidence supports each claim
- Prevents hallucination

### Negative
- More complex AI implementation
- May produce more "I don't know" responses initially
- Requires robust evidence extraction pipeline

### Mitigation
- Start with high confidence threshold (0.8), lower as system improves
- Build evidence extraction pipeline before AI features
- Log all "I don't know" responses to identify gaps

## Alternatives Considered
- **No gating**: Simpler, but risks hallucination
- **Post-hoc validation**: Validate after generation, but adds latency
- **Human review**: Most accurate, but doesn't scale
