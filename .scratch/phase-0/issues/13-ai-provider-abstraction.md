# 13: AI Provider Abstraction

**What to build:** A document defining the AI provider interface and structured output schema.

**Blocked by:** 12 (needs evidence gating model)

**Status:** ready-for-agent

- [ ] Provider interface (AIProvider)
- [ ] Supported providers: OpenAI, Anthropic, Google
- [ ] Structured output schema:
  ```json
  {
    "summary": "...",
    "severity": "low|medium|high|critical",
    "confidence": 0.0-1.0,
    "rootCauses": [{"cause": "...", "evidence": [...]}],
    "recommendations": [{"action": "...", "impact": "..."}]
  }
  ```
- [ ] Provider fallback strategy
- [ ] Cost tracking per provider
- [ ] Model selection strategy (speed vs quality)

**Output:** `docs/architecture/ai-providers.md`
