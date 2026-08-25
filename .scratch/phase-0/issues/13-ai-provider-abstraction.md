# 13: AI Provider Abstraction

**What to build:** A document defining the AI provider interface and structured output schema.

**Blocked by:** 12 (needs evidence gating model)

**Status:** done

- [x] Provider interface (AIProvider)
- [x] Supported providers: OpenAI, Anthropic, Google
- [x] Structured output schema:
  ```json
  {
    "summary": "...",
    "severity": "low|medium|high|critical",
    "confidence": 0.0-1.0,
    "rootCauses": [{"cause": "...", "evidence": [...]}],
    "recommendations": [{"action": "...", "impact": "..."}]
  }
  ```
- [x] Provider fallback strategy
- [x] Cost tracking per provider
- [x] Model selection strategy (speed vs quality)

**Output:** `docs/architecture/ai-provider-abstraction.md`
