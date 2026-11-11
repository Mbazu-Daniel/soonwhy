import type { InfrastructureMetrics, InfrastructureAggregation } from "./infrastructure-intelligence.types";
import { createTelemetryIdentity, fingerprintHost } from "@soonwhy/shared";

export function aggregateInfrastructureMetrics(
  metrics: InfrastructureMetrics[],
): InfrastructureAggregation {
  if (metrics.length === 0) {
    throw new Error("Cannot aggregate empty metrics");
  }

  const first = metrics[0];
  if (!first) {
    throw new Error("First metric is undefined");
  }

  const identity = createTelemetryIdentity({
    domain: "infrastructure",
    hostId: first.hostId,
    containerId: first.containerId,
  });

  const sumCpu = metrics.reduce((sum, m) => sum + m.cpuUsagePercent, 0);
  const sumMemory = metrics.reduce((sum, m) => sum + m.memoryUsagePercent, 0);
  const sumDisk = metrics.reduce((sum, m) => sum + m.diskUsagePercent, 0);
  const sumNetIn = metrics.reduce((sum, m) => sum + m.networkInBytes, 0);
  const sumNetOut = metrics.reduce((sum, m) => sum + m.networkOutBytes, 0);

  return {
    identity,
    avgCpuUsage: sumCpu / metrics.length,
    avgMemoryUsage: sumMemory / metrics.length,
    avgDiskUsage: sumDisk / metrics.length,
    avgNetworkInBytes: sumNetIn / metrics.length,
    avgNetworkOutBytes: sumNetOut / metrics.length,
    sampleCount: metrics.length,
  };
}
