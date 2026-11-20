export interface AiInvocationMetrics {
  provider: string;
  model: string;
  status: "succeeded" | "failed";
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
}
