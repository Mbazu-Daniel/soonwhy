import type { AIOperation, AIAggregation } from "./ai-intelligence.types";
import { createTelemetryIdentity, fingerprintAIOperation } from "@soonwhy/shared";

export function aggregateAIOperations(operations: AIOperation[]): AIAggregation {
  if (operations.length === 0) {
    throw new Error("Cannot aggregate empty operations");
  }

  const first = operations[0];
  if (!first) {
    throw new Error("First operation is undefined");
  }

  const identity = createTelemetryIdentity({
    domain: "ai",
    serviceName: first.serviceName,
    operationName: first.operationType,
    resourceName: first.model,
    identityAttributes: {
      provider: first.provider,
      model: first.model,
      operationType: first.operationType,
    },
  });

  const totalTokens = operations.reduce((sum, op) => sum + (op.totalTokens || 0), 0);
  const totalCost = operations.reduce((sum, op) => sum + (op.costUsd || 0), 0);
  const latencies = operations.map((op) => op.latencyMs).sort((a, b) => a - b);
  const errorCount = operations.filter((op) => op.error).length;

  const timestamps = operations.map((op) => new Date(op.timestamp).getTime());
  const startTime = new Date(Math.min(...timestamps)).toISOString();
  const endTime = new Date(Math.max(...timestamps)).toISOString();

  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  return {
    identity,
    operationCount: operations.length,
    totalTokens,
    avgTokensPerOperation: totalTokens / operations.length,
    totalCostUsd: totalCost,
    avgLatencyMs: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    p99LatencyMs: p99,
    errorCount,
    errorRate: errorCount / operations.length,
    timeWindow: {
      start: startTime,
      end: endTime,
    },
  };
}

export function groupOperationsByModel(operations: AIOperation[]): Map<string, AIOperation[]> {
  const grouped = new Map<string, AIOperation[]>();
  for (const op of operations) {
    const key = `${op.provider}:${op.model}`;
    const existing = grouped.get(key) || [];
    existing.push(op);
    grouped.set(key, existing);
  }
  return grouped;
}

export function groupOperationsByType(operations: AIOperation[]): Map<string, AIOperation[]> {
  const grouped = new Map<string, AIOperation[]>();
  for (const op of operations) {
    const existing = grouped.get(op.operationType) || [];
    existing.push(op);
    grouped.set(op.operationType, existing);
  }
  return grouped;
}
