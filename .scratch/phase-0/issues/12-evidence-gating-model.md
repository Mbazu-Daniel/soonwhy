# 12: Evidence Gating Model

**What to build:** A document defining how the AI gets evidence and prevents hallucination.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Evidence requirement: AI can only reference data actually queried
- [x] Confidence scoring (0-1 scale, threshold at 0.7)
- [x] Low-confidence response format: "I see anomalies but can't determine root cause..."
- [x] Context builder: telemetry → evidence → LLM prompt
- [x] Audit trail: input query, evidence used, model, confidence, latency
- [x] Hallucination safeguards (no claims without citations)
- [x] Evidence types (latency spike, error increase, deployment correlation)

**Output:** `docs/architecture/ai-evidence-gating.md`
