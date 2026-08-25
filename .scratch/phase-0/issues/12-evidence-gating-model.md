# 12: Evidence Gating Model

**What to build:** A document defining how the AI gets evidence and prevents hallucination.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Evidence requirement: AI can only reference data actually queried
- [ ] Confidence scoring (0-1 scale, threshold at 0.7)
- [ ] Low-confidence response format: "I see anomalies but can't determine root cause..."
- [ ] Context builder: telemetry → evidence → LLM prompt
- [ ] Audit trail: input query, evidence used, model, confidence, latency
- [ ] Hallucination safeguards (no claims without citations)
- [ ] Evidence types (latency spike, error increase, deployment correlation)

**Output:** `docs/architecture/ai-evidence.md`
