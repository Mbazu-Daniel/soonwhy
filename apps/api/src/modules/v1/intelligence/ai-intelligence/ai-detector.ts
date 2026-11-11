import type {
  AIOperation,
  AITokenSpikeFinding,
  AICostSpikeFinding,
  AILatencyRegressionFinding,
  AIProviderFailureFinding,
  AIModelFailureFinding,
  AIRateLimitFinding,
  AIRetryLoopFinding,
  AIToolCallFailureFinding,
  AIAgentLoopFinding,
  AIRetrievalFailureFinding,
} from "./ai-intelligence.types";
import { createTelemetryIdentity } from "@soonwhy/shared";

export function detectTokenSpike(
  operations: AIOperation[],
  baselineTokensPerMinute: number,
  thresholdPercent: number = 2.0,
): AITokenSpikeFinding[] {
  const findings: AITokenSpikeFinding[] = [];

  const timestamps = operations.map((op) => new Date(op.timestamp).getTime());
  const durationMs = Math.max(...timestamps) - Math.min(...timestamps) || 60000;
  const durationMinutes = durationMs / 60000;

  const totalTokens = operations.reduce((sum, op) => sum + (op.totalTokens || 0), 0);
  const currentTokensPerMinute = totalTokens / durationMinutes;

  const changePercent = (currentTokensPerMinute - baselineTokensPerMinute) / baselineTokensPerMinute;

  if (changePercent > thresholdPercent) {
    const first = operations[0];
    if (!first) return findings;

    findings.push({
      identity: createTelemetryIdentity({
        domain: "ai",
        serviceName: first.serviceName,
        operationName: first.operationType,
        resourceName: first.model,
      }),
      baselineTokensPerMinute,
      currentTokensPerMinute,
      changePercent: changePercent * 100,
      severity: changePercent > 3.0 ? "critical" : "warning",
      evidence: [
        `Total tokens in window: ${totalTokens}`,
        `Duration: ${durationMinutes.toFixed(2)} minutes`,
        `Baseline: ${baselineTokensPerMinute.toFixed(0)} tokens/min`,
        `Current: ${currentTokensPerMinute.toFixed(0)} tokens/min`,
      ],
      confidence: 0.9,
    });
  }

  return findings;
}

export function detectCostSpike(
  operations: AIOperation[],
  baselineCostPerHour: number,
  thresholdPercent: number = 2.0,
): AICostSpikeFinding[] {
  const findings: AICostSpikeFinding[] = [];

  const timestamps = operations.map((op) => new Date(op.timestamp).getTime());
  const durationMs = Math.max(...timestamps) - Math.min(...timestamps) || 60000;
  const durationHours = durationMs / 3600000;

  const totalCost = operations.reduce((sum, op) => sum + (op.costUsd || 0), 0);
  const currentCostPerHour = totalCost / durationHours;

  const changePercent = (currentCostPerHour - baselineCostPerHour) / baselineCostPerHour;

  if (changePercent > thresholdPercent) {
    const first = operations[0];
    if (!first) return findings;

    findings.push({
      identity: createTelemetryIdentity({
        domain: "ai",
        serviceName: first.serviceName,
        operationName: first.operationType,
        resourceName: first.model,
      }),
      baselineCostPerHour,
      currentCostPerHour,
      changePercent: changePercent * 100,
      severity: changePercent > 3.0 ? "critical" : "warning",
      evidence: [
        `Total cost in window: $${totalCost.toFixed(2)}`,
        `Duration: ${durationHours.toFixed(2)} hours`,
        `Baseline: $${baselineCostPerHour.toFixed(2)}/hour`,
        `Current: $${currentCostPerHour.toFixed(2)}/hour`,
      ],
      confidence: 0.9,
    });
  }

  return findings;
}

export function detectLatencyRegression(
  operations: AIOperation[],
  baselineLatencyMs: number,
  thresholdPercent: number = 0.5,
): AILatencyRegressionFinding[] {
  const findings: AILatencyRegressionFinding[] = [];

  const latencies = operations.map((op) => op.latencyMs);
  const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

  const changePercent = (avgLatency - baselineLatencyMs) / baselineLatencyMs;

  if (changePercent > thresholdPercent) {
    const first = operations[0];
    if (!first) return findings;

    findings.push({
      identity: createTelemetryIdentity({
        domain: "ai",
        serviceName: first.serviceName,
        operationName: first.operationType,
        resourceName: first.model,
      }),
      baselineLatencyMs,
      currentLatencyMs: avgLatency,
      changePercent: changePercent * 100,
      severity: changePercent > 1.0 ? "critical" : "warning",
      evidence: [
        `Average latency: ${avgLatency.toFixed(0)}ms`,
        `Baseline: ${baselineLatencyMs.toFixed(0)}ms`,
        `Sample count: ${operations.length}`,
      ],
      confidence: 0.85,
    });
  }

  return findings;
}

export function detectProviderFailure(
  operations: AIOperation[],
  errorRateThreshold: number = 0.1,
): AIProviderFailureFinding[] {
  const findings: AIProviderFailureFinding[] = [];

  const byProvider = new Map<string, AIOperation[]>();
  for (const op of operations) {
    const existing = byProvider.get(op.provider) || [];
    existing.push(op);
    byProvider.set(op.provider, existing);
  }

  for (const [provider, providerOps] of byProvider) {
    const errorCount = providerOps.filter((op) => op.error).length;
    const errorRate = errorCount / providerOps.length;

    if (errorRate > errorRateThreshold) {
      const first = providerOps[0];
      if (!first) continue;

      const affectedModels = new Set(providerOps.map((op) => op.model));

      findings.push({
        identity: createTelemetryIdentity({
          domain: "ai",
          serviceName: first.serviceName,
          operationName: first.operationType,
          resourceName: first.model,
        }),
        provider: provider as any,
        errorCount,
        errorRate,
        affectedModels: Array.from(affectedModels),
        severity: errorRate > 0.3 ? "critical" : "warning",
        evidence: [
          `Provider: ${provider}`,
          `Error rate: ${(errorRate * 100).toFixed(1)}%`,
          `Affected models: ${Array.from(affectedModels).join(", ")}`,
        ],
        confidence: 0.95,
      });
    }
  }

  return findings;
}

export function detectModelFailure(
  operations: AIOperation[],
  errorRateThreshold: number = 0.1,
): AIModelFailureFinding[] {
  const findings: AIModelFailureFinding[] = [];

  const byModel = new Map<string, AIOperation[]>();
  for (const op of operations) {
    const key = `${op.provider}:${op.model}`;
    const existing = byModel.get(key) || [];
    existing.push(op);
    byModel.set(key, existing);
  }

  for (const [key, modelOps] of byModel) {
    const parts = key.split(":");
    const provider = parts[0];
    const model = parts[1];
    if (!provider || !model) continue;

    const errorCount = modelOps.filter((op) => op.error).length;
    const errorRate = errorCount / modelOps.length;

    if (errorRate > errorRateThreshold) {
      const first = modelOps[0];
      if (!first) continue;

      findings.push({
        identity: createTelemetryIdentity({
          domain: "ai",
          serviceName: first.serviceName,
          operationName: first.operationType,
          resourceName: first.model,
        }),
        provider: provider as any,
        model,
        errorCount,
        errorRate,
        severity: errorRate > 0.3 ? "critical" : "warning",
        evidence: [
          `Model: ${model}`,
          `Provider: ${provider}`,
          `Error rate: ${(errorRate * 100).toFixed(1)}%`,
        ],
        confidence: 0.95,
      });
    }
  }

  return findings;
}

export function detectRateLimitHits(
  operations: AIOperation[],
): AIRateLimitFinding[] {
  const findings: AIRateLimitFinding[] = [];

  const byModel = new Map<string, AIOperation[]>();
  for (const op of operations) {
    const key = `${op.provider}:${op.model}`;
    const existing = byModel.get(key) || [];
    existing.push(op);
    byModel.set(key, existing);
  }

  for (const [key, modelOps] of byModel) {
    const parts = key.split(":");
    const provider = parts[0];
    const model = parts[1];
    if (!provider || !model) continue;

    const rateLimitErrors = modelOps.filter((op) =>
      op.error?.toLowerCase().includes("rate limit") ||
      op.error?.toLowerCase().includes("429"),
    );

    if (rateLimitErrors.length > 0) {
      const first = modelOps[0];
      if (!first) continue;

      const timestamps = modelOps.map((op) => new Date(op.timestamp).getTime());
      const durationMs = Math.max(...timestamps) - Math.min(...timestamps) || 60000;

      findings.push({
        identity: createTelemetryIdentity({
          domain: "ai",
          serviceName: first.serviceName,
          operationName: first.operationType,
          resourceName: first.model,
        }),
        provider: provider as any,
        model,
        rateLimitHits: rateLimitErrors.length,
        timeWindow: `${(durationMs / 1000).toFixed(0)}s`,
        severity: rateLimitErrors.length > 5 ? "critical" : "warning",
        evidence: [
          `Rate limit hits: ${rateLimitErrors.length}`,
          `Time window: ${(durationMs / 1000).toFixed(0)}s`,
        ],
        confidence: 0.95,
      });
    }
  }

  return findings;
}

export function detectRetryLoops(
  operations: AIOperation[],
  maxRetries: number = 3,
): AIRetryLoopFinding[] {
  const findings: AIRetryLoopFinding[] = [];

  const byOperationId = new Map<string, AIOperation[]>();
  for (const op of operations) {
    if (op.id) {
      const existing = byOperationId.get(op.id) || [];
      existing.push(op);
      byOperationId.set(op.id, existing);
    }
  }

  for (const [operationId, retries] of byOperationId) {
    if (retries.length > maxRetries) {
      const first = retries[0];
      if (!first) continue;

      const errors = retries.map((op) => op.error).filter(Boolean);
      const errorPattern = errors.length > 0 ? errors[0] as string : "unknown";

      findings.push({
        identity: createTelemetryIdentity({
          domain: "ai",
          serviceName: first.serviceName,
          operationName: first.operationType,
          resourceName: first.model,
        }),
        operationId,
        retryCount: retries.length,
        totalLatencyMs: retries.reduce((sum, op) => sum + op.latencyMs, 0),
        errorPattern,
        severity: retries.length > 5 ? "critical" : "warning",
        evidence: [
          `Retry count: ${retries.length}`,
          `Total latency: ${retries.reduce((sum, op) => sum + op.latencyMs, 0).toFixed(0)}ms`,
          `Error pattern: ${errorPattern}`,
        ],
        confidence: 0.9,
      });
    }
  }

  return findings;
}

export function detectToolCallFailures(
  operations: AIOperation[],
  errorRateThreshold: number = 0.2,
): AIToolCallFailureFinding[] {
  const findings: AIToolCallFailureFinding[] = [];

  const toolCalls = operations.filter((op) => op.operationType === "tool_call");

  const byTool = new Map<string, AIOperation[]>();
  for (const op of toolCalls) {
    const toolName = op.metadata?.toolName as string || "unknown";
    const existing = byTool.get(toolName) || [];
    existing.push(op);
    byTool.set(toolName, existing);
  }

  for (const [toolName, toolOps] of byTool) {
    const errorCount = toolOps.filter((op) => op.error).length;
    const errorRate = errorCount / toolOps.length;

    if (errorRate > errorRateThreshold) {
      const first = toolOps[0];
      if (!first) continue;

      const avgLatency = toolOps.reduce((sum, op) => sum + op.latencyMs, 0) / toolOps.length;

      findings.push({
        identity: createTelemetryIdentity({
          domain: "ai",
          serviceName: first.serviceName,
          operationName: first.operationType,
          resourceName: toolName,
        }),
        toolName,
        errorCount,
        errorRate,
        avgLatencyMs: avgLatency,
        severity: errorRate > 0.5 ? "critical" : "warning",
        evidence: [
          `Tool: ${toolName}`,
          `Error rate: ${(errorRate * 100).toFixed(1)}%`,
          `Average latency: ${avgLatency.toFixed(0)}ms`,
        ],
        confidence: 0.85,
      });
    }
  }

  return findings;
}

export function detectAgentLoops(
  operations: AIOperation[],
  maxSteps: number = 10,
): AIAgentLoopFinding[] {
  const findings: AIAgentLoopFinding[] = [];

  const byTrace = new Map<string, AIOperation[]>();
  for (const op of operations) {
    if (op.traceId) {
      const existing = byTrace.get(op.traceId) || [];
      existing.push(op);
      byTrace.set(op.traceId, existing);
    }
  }

  for (const [traceId, traceOps] of byTrace) {
    const agentSteps = traceOps.filter((op) => op.operationType === "agent_step");

    if (agentSteps.length > maxSteps) {
      const first = agentSteps[0];
      if (!first) continue;

      const totalLatency = agentSteps.reduce((sum, op) => sum + op.latencyMs, 0);

      findings.push({
        identity: createTelemetryIdentity({
          domain: "ai",
          serviceName: first.serviceName,
          operationName: first.operationType,
          resourceName: first.model,
        }),
        loopType: agentSteps.length > 20 ? "infinite" : "excessive",
        stepCount: agentSteps.length,
        totalLatencyMs: totalLatency,
        pattern: "excessive agent steps without termination",
        severity: agentSteps.length > 20 ? "critical" : "warning",
        evidence: [
          `Agent steps: ${agentSteps.length}`,
          `Total latency: ${totalLatency.toFixed(0)}ms`,
          `Trace ID: ${traceId}`,
        ],
        confidence: 0.9,
      });
    }
  }

  return findings;
}

export function detectRetrievalFailures(
  operations: AIOperation[],
  errorRateThreshold: number = 0.15,
): AIRetrievalFailureFinding[] {
  const findings: AIRetrievalFailureFinding[] = [];

  const retrievals = operations.filter((op) => op.operationType === "retrieval");

  const bySource = new Map<string, AIOperation[]>();
  for (const op of retrievals) {
    const source = op.metadata?.source as string || "unknown";
    const existing = bySource.get(source) || [];
    existing.push(op);
    bySource.set(source, existing);
  }

  for (const [source, sourceOps] of bySource) {
    const errorCount = sourceOps.filter((op) => op.error).length;
    const errorRate = errorCount / sourceOps.length;

    if (errorRate > errorRateThreshold) {
      const first = sourceOps[0];
      if (!first) continue;

      const avgResults = sourceOps.reduce((sum, op) => sum + (op.metadata?.resultsCount as number || 0), 0) / sourceOps.length;

      findings.push({
        identity: createTelemetryIdentity({
          domain: "ai",
          serviceName: first.serviceName,
          operationName: first.operationType,
          resourceName: source,
        }),
        source,
        errorCount,
        errorRate,
        avgResultsCount: avgResults,
        severity: errorRate > 0.4 ? "critical" : "warning",
        evidence: [
          `Retrieval source: ${source}`,
          `Error rate: ${(errorRate * 100).toFixed(1)}%`,
          `Average results: ${avgResults.toFixed(0)}`,
        ],
        confidence: 0.85,
      });
    }
  }

  return findings;
}
