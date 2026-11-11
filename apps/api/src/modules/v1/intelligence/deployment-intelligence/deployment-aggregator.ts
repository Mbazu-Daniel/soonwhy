import type { DeploymentMetrics, DeploymentAggregation, DeploymentComparison } from "./deployment-intelligence.types";
import { createTelemetryIdentity } from "@soonwhy/shared";

export function aggregateDeploymentMetrics(
  metrics: DeploymentMetrics[],
): DeploymentAggregation {
  if (metrics.length === 0) {
    throw new Error("Cannot aggregate empty metrics");
  }

  const first = metrics[0];
  if (!first) {
    throw new Error("First metric is undefined");
  }

  const identity = createTelemetryIdentity({
    domain: "performance",
    serviceName: first.serviceName,
    operationName: first.version,
    resourceName: first.deploymentId,
  });

  const sumLatency = metrics.reduce((sum, m) => sum + (m.latencyMs ?? 0), 0);
  const sumErrorRate = metrics.reduce((sum, m) => sum + (m.errorRate ?? 0), 0);
  const sumThroughput = metrics.reduce((sum, m) => sum + (m.throughput ?? 0), 0);

  return {
    identity,
    avgLatencyMs: sumLatency / metrics.length,
    avgErrorRate: sumErrorRate / metrics.length,
    avgThroughput: sumThroughput / metrics.length,
    sampleCount: metrics.length,
  };
}

export function compareDeployments(
  before: DeploymentMetrics[],
  after: DeploymentMetrics[],
): DeploymentComparison {
  const beforeAgg = aggregateDeploymentMetrics(before);
  const afterAgg = aggregateDeploymentMetrics(after);

  const firstAfter = after[0];
  if (!firstAfter) {
    throw new Error("After deployment metrics is empty");
  }

  const latencyChange = (afterAgg.avgLatencyMs - beforeAgg.avgLatencyMs) / beforeAgg.avgLatencyMs;
  const errorRateChange = (afterAgg.avgErrorRate - beforeAgg.avgErrorRate) / (beforeAgg.avgErrorRate || 1);
  const throughputChange = (afterAgg.avgThroughput - beforeAgg.avgThroughput) / (beforeAgg.avgThroughput || 1);

  const isDegraded = latencyChange > 0.5 || errorRateChange > 1.0 || throughputChange < -0.3;
  const isImproved = latencyChange < -0.2 || errorRateChange < -0.5 || throughputChange > 0.2;

  return {
    deploymentId: firstAfter.deploymentId,
    beforeAggregation: beforeAgg,
    afterAggregation: afterAgg,
    latencyChangePercent: latencyChange * 100,
    errorRateChangePercent: errorRateChange * 100,
    throughputChangePercent: throughputChange * 100,
    severity: isDegraded ? "critical" : isImproved ? "improved" : "warning",
  };
}
