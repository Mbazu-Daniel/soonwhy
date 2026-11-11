import type { TelemetryIdentity } from "@soonwhy/shared";

export type AIProvider = "openai" | "anthropic" | "google" | "cohere" | "azure" | "custom";

export type AIOperationType =
  | "chat"
  | "completion"
  | "embedding"
  | "tool_call"
  | "retrieval"
  | "agent_step"
  | "agent_loop"
  | "function_call";

export interface AIOperation {
  id: string;
  timestamp: string;
  provider: AIProvider;
  model: string;
  operationType: AIOperationType;
  prompt?: string;
  completion?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  costUsd?: number;
  error?: string;
  traceId?: string;
  spanId?: string;
  serviceName?: string;
  endpoint?: string;
  userId?: string;
  deploymentId?: string;
  metadata?: Record<string, unknown>;
}

export interface AIToolCall {
  toolName: string;
  toolType: "function" | "retrieval" | "code_interpreter" | "custom";
  input?: string;
  output?: string;
  latencyMs: number;
  error?: string;
}

export interface AIRetrieval {
  source: string;
  query: string;
  resultsCount: number;
  latencyMs: number;
  error?: string;
}

export interface AIAgentStep {
  stepNumber: number;
  stepType: "thought" | "action" | "observation" | "final_answer";
  input?: string;
  output?: string;
  toolCalls?: AIToolCall[];
  latencyMs: number;
}

export interface AIAggregation {
  identity: TelemetryIdentity;
  operationCount: number;
  totalTokens: number;
  avgTokensPerOperation: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorCount: number;
  errorRate: number;
  timeWindow: {
    start: string;
    end: string;
  };
}

export interface AIDetection {
  tokenSpike: AITokenSpikeFinding[];
  costSpike: AICostSpikeFinding[];
  latencyRegression: AILatencyRegressionFinding[];
  providerFailure: AIProviderFailureFinding[];
  modelFailure: AIModelFailureFinding[];
  rateLimitHit: AIRateLimitFinding[];
  retryLoop: AIRetryLoopFinding[];
  toolCallFailure: AIToolCallFailureFinding[];
  agentLoop: AIAgentLoopFinding[];
  retrievalFailure: AIRetrievalFailureFinding[];
}

export interface AITokenSpikeFinding {
  identity: TelemetryIdentity;
  baselineTokensPerMinute: number;
  currentTokensPerMinute: number;
  changePercent: number;
  severity: "warning" | "critical";
  evidence: string[];
  confidence: number;
}

export interface AICostSpikeFinding {
  identity: TelemetryIdentity;
  baselineCostPerHour: number;
  currentCostPerHour: number;
  changePercent: number;
  severity: "warning" | "critical";
  evidence: string[];
  confidence: number;
}

export interface AILatencyRegressionFinding {
  identity: TelemetryIdentity;
  baselineLatencyMs: number;
  currentLatencyMs: number;
  changePercent: number;
  severity: "warning" | "critical";
  evidence: string[];
  confidence: number;
}

export interface AIProviderFailureFinding {
  identity: TelemetryIdentity;
  provider: AIProvider;
  errorCount: number;
  errorRate: number;
  affectedModels: string[];
  severity: "warning" | "critical";
  evidence: string[];
  confidence: number;
}

export interface AIModelFailureFinding {
  identity: TelemetryIdentity;
  provider: AIProvider;
  model: string;
  errorCount: number;
  errorRate: number;
  severity: "warning" | "critical";
  evidence: string[];
  confidence: number;
}

export interface AIRateLimitFinding {
  identity: TelemetryIdentity;
  provider: AIProvider;
  model: string;
  rateLimitHits: number;
  timeWindow: string;
  severity: "warning" | "critical";
  evidence: string[];
  confidence: number;
}

export interface AIRetryLoopFinding {
  identity: TelemetryIdentity;
  operationId: string;
  retryCount: number;
  totalLatencyMs: number;
  errorPattern: string;
  severity: "warning" | "critical";
  evidence: string[];
  confidence: number;
}

export interface AIToolCallFailureFinding {
  identity: TelemetryIdentity;
  toolName: string;
  errorCount: number;
  errorRate: number;
  avgLatencyMs: number;
  severity: "warning" | "critical";
  evidence: string[];
  confidence: number;
}

export interface AIAgentLoopFinding {
  identity: TelemetryIdentity;
  loopType: "infinite" | "excessive" | "unexpected";
  stepCount: number;
  totalLatencyMs: number;
  pattern: string;
  severity: "warning" | "critical";
  evidence: string[];
  confidence: number;
}

export interface AIRetrievalFailureFinding {
  identity: TelemetryIdentity;
  source: string;
  errorCount: number;
  errorRate: number;
  avgResultsCount: number;
  severity: "warning" | "critical";
  evidence: string[];
  confidence: number;
}
