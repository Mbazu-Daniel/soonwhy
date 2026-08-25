# AI Provider Abstraction

Soonwhy uses multiple LLM providers. This document defines the abstraction layer that normalizes calls, enforces fallback, tracks cost, and streams responses.

## Provider Interface

```typescript
interface AiProvider {
  id: string;
  name: string;
  type: "openai" | "anthropic" | "google";

  complete(req: CompletionRequest): Promise<CompletionResponse>;
  stream(req: CompletionRequest): AsyncIterable<CompletionChunk>;
  estimateCost(req: CompletionRequest): CostEstimate;
  isAvailable(): Promise<boolean>;
  rateLimitStatus(): RateLimitInfo;
}
```

### CompletionRequest

```typescript
interface CompletionRequest {
  model: string;
  messages: Message[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
  evidenceSet?: EvidenceItem[];   // from evidence gating pipeline
  metadata?: Record<string, unknown>;
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}
```

### CompletionResponse (Normalized)

All providers return this shape. Provider-specific fields are mapped into it.

```typescript
interface CompletionResponse {
  provider: string;
  model: string;
  content: string;
  finishReason: "stop" | "length" | "content_filter" | "error";
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  raw?: unknown;           // original provider response for debugging
}
```

### CompletionChunk (Streaming)

```typescript
interface CompletionChunk {
  delta: string;
  finishReason?: "stop" | "length" | "content_filter" | "error";
  usage?: CompletionResponse["usage"];  // final chunk includes totals
}
```

## Supported Providers

| Provider | Primary Model | Fallback Model | Notes |
|----------|--------------|----------------|-------|
| OpenAI | gpt-4o | gpt-4o-mini | JSON mode, structured outputs |
| Anthropic | claude-sonnet-4-20250514 | claude-haiku-3-20240307 | Extended thinking, large context |
| Google | gemini-2.5-pro | gemini-2.5-flash | Multi-modal, long context |

Provider list is configurable. New providers are added by implementing `AiProvider`.

## Fallback Strategy

Primary → secondary chain. On failure, the orchestrator retries with the next provider.

```
1. Try primary provider (configurable, default: openai)
2. If rate limited or error → try secondary
3. If secondary fails → try tertiary
4. If all fail → return error response with degraded content
```

### Trigger Conditions

Fallback activates on:
- HTTP 429 (rate limit)
- HTTP 5xx (server error)
- Timeout (> 30s for non-streaming, > 60s for streaming)
- Content filter rejection
- Provider explicitly reports unavailable

Fallback does NOT activate on:
- Invalid request (bad prompt, missing fields) — caller's fault
- Low confidence score from evidence gating — that is a separate gate

### Fallback Config

```typescript
interface FallbackConfig {
  enabled: boolean;
  maxRetries: number;        // default: 2
  retryDelayMs: number;      // exponential backoff base, default: 1000
  providers: string[];       // ordered list: ["openai", "anthropic", "google"]
}
```

## Rate Limiting

Each provider tracks limits independently. Limits are enforced before the call, not after.

```typescript
interface RateLimitInfo {
  provider: string;
  requestsRemaining: number;
  requestsLimit: number;
  tokensRemaining: number;
  tokensLimit: number;
  resetsAt: Date;
}
```

### Strategy

- **Token bucket** per provider: refills at provider's documented RPM/TPM.
- **Circuit breaker**: if error rate exceeds 50% over a 1-minute window, mark provider as unavailable for 5 minutes.
- **Priority queue**: high-priority requests (user-initiated RCA) bypass low-priority (background enrichment).

## Cost Tracking

Every completion logs cost. Costs are aggregated daily per provider and model.

```typescript
interface CostEstimate {
  provider: string;
  model: string;
  promptCost: number;     // USD
  completionCost: number; // USD
  totalCost: number;      // USD
}

interface CostRecord {
  id: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  timestamp: Date;
  queryId?: string;
  userId?: string;
}
```

### Pricing Table

Pricing is stored in config and updated manually when providers change rates.

```typescript
const PROVIDER_PRICING: Record<string, Record<string, { prompt: number; completion: number }>> = {
  openai: {
    "gpt-4o":        { prompt: 0.0025, completion: 0.01 },   // per 1k tokens
    "gpt-4o-mini":   { prompt: 0.00015, completion: 0.0006 },
  },
  anthropic: {
    "claude-sonnet-4-20250514": { prompt: 0.003, completion: 0.015 },
    "claude-haiku-3-20240307":  { prompt: 0.00025, completion: 0.00125 },
  },
  google: {
    "gemini-2.5-pro":   { prompt: 0.00125, completion: 0.005 },
    "gemini-2.5-flash": { prompt: 0.000075, completion: 0.0003 },
  },
};
```

### Budget Guard

Daily cost per provider is capped. When a provider hits its budget, traffic routes to the next provider for the rest of the day.

```typescript
interface BudgetConfig {
  dailyLimitUsd: number;      // default: 50.00
  alertThreshold: number;     // 0.8 = alert at 80%
  hardStop: boolean;          // true = stop using provider when limit hit
}
```

## Response Normalization

The adapter layer maps provider-specific responses into `CompletionResponse`.

### OpenAI

```typescript
function normalizeOpenAi(res: OpenAiResponse): CompletionResponse {
  return {
    provider: "openai",
    model: res.model,
    content: res.choices[0].message.content,
    finishReason: mapFinishReason(res.choices[0].finish_reason),
    usage: {
      promptTokens: res.usage.prompt_tokens,
      completionTokens: res.usage.completion_tokens,
      totalTokens: res.usage.total_tokens,
    },
    latencyMs: res._latencyMs,
    raw: res,
  };
}
```

### Anthropic

```typescript
function normalizeAnthropic(res: AnthropicResponse): CompletionResponse {
  return {
    provider: "anthropic",
    model: res.model,
    content: res.content[0].text,
    finishReason: mapFinishReason(res.stop_reason),
    usage: {
      promptTokens: res.usage.input_tokens,
      completionTokens: res.usage.output_tokens,
      totalTokens: res.usage.input_tokens + res.usage.output_tokens,
    },
    latencyMs: res._latencyMs,
    raw: res,
  };
}
```

### Google

```typescript
function normalizeGoogle(res: GoogleResponse): CompletionResponse {
  const candidate = res.candidates[0];
  return {
    provider: "google",
    model: res.modelVersion,
    content: candidate.content.parts[0].text,
    finishReason: mapFinishReason(candidate.finishReason),
    usage: {
      promptTokens: res.usageMetadata.promptTokenCount,
      completionTokens: res.usageMetadata.candidatesTokenCount,
      totalTokens: res.usageMetadata.totalTokenCount,
    },
    latencyMs: res._latencyMs,
    raw: res,
  };
}
```

## Streaming Support

Streaming is required for real-time RCA feedback. The orchestrator consumes `AsyncIterable<CompletionChunk>` and forwards chunks to the client via SSE.

### Stream Orchestration

```typescript
async function* streamWithFallback(
  req: CompletionRequest,
  providers: AiProvider[],
): AsyncGenerator<CompletionChunk> {
  for (const provider of providers) {
    if (!(await provider.isAvailable())) continue;
    try {
      yield* provider.stream(req);
      return;
    } catch (err) {
      if (isRetryableError(err)) continue;
      throw err;
    }
  }
  throw new AllProvidersFailedError();
}
```

### SSE Format

```
data: {"delta":"The","finishReason":null}
data: {"delta":" root","finishReason":null}
data: {"delta":" cause","finishReason":null}
data: {"delta":"","finishReason":"stop","usage":{"promptTokens":1200,"completionTokens":84,"totalTokens":1284}}
data: [DONE]
```

## Structured Output

For RCA responses, the LLM is constrained to JSON via provider-native structured output or post-processing validation.

```typescript
interface RCAOutput {
  summary: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;         // 0.0 - 1.0 (from evidence gating)
  rootCauses: Array<{
    cause: string;
    evidence: string[];       // evidence IDs: ["E1", "E3"]
    likelihood: number;
  }>;
  recommendations: Array<{
    action: string;
    impact: string;
    priority: number;
  }>;
}
```

### Validation

Post-generation validator checks:
- JSON parses without error
- All required fields present
- `severity` is one of the allowed values
- `confidence` is within [0, 1]
- Every evidence ID in `rootCauses` exists in the input evidence set

Failed validation → retry once with a stricter prompt. Second failure → return the raw text response with a warning.

## Model Selection Strategy

Model is chosen based on task requirements, not hardcoded.

| Task | Priority | Model Selection |
|------|----------|-----------------|
| User-initiated RCA | Quality | Primary model (gpt-4o, claude-sonnet) |
| Background enrichment | Speed | Fast model (gpt-4o-mini, gemini-flash) |
| Structured extraction | Accuracy | Provider with best structured output support |
| Cost-sensitive batch | Cost | Cheapest available |

Selection is driven by a `taskType` field on `CompletionRequest`:

```typescript
interface CompletionRequest {
  // ... existing fields
  taskType?: "rca" | "enrichment" | "extraction" | "batch";
}
```

The orchestrator maps `taskType` → model via config.

## Audit Integration

Every completion is logged to `AiAuditLog` (defined in [ai-evidence-gating.md](./ai-evidence-gating.md)). The provider abstraction is responsible for populating:

- `model` — which model answered
- `latencyMs` — time to first token (streaming) or total time
- `fallbackTriggered` — true if the primary provider failed

Cost records are written alongside audit logs for unified querying.
