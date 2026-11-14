import type {
  RuntimeMetrics,
  RuntimeAggregation,
} from "./runtime-intelligence.types";
import {
  createTelemetryIdentity,
  fingerprintHost,
} from "@soonwhy/shared";

export function aggregateRuntimeMetrics(
  metrics: RuntimeMetrics[],
): RuntimeAggregation {
  if (metrics.length === 0) {
    throw new Error("Cannot aggregate empty metrics list");
  }

  const first = metrics[0];
  if (!first) {
    throw new Error("First metric is undefined");
  }

  const identity = createTelemetryIdentity({
    domain: "runtime",
    serviceName: first.serviceName,
    hostId: first.hostId,
    containerId: first.containerId,
    processId: first.processId,
  });

  const sumCpu = metrics.reduce((sum, m) => sum + m.cpuUsagePercent, 0);
  const sumHeapUsed = metrics.reduce((sum, m) => sum + m.heapUsedMB, 0);
  const sumHeapTotal = metrics.reduce((sum, m) => sum + m.heapTotalMB, 0);
  const sumHeapLimit = metrics.reduce((sum, m) => sum + m.heapLimitMB, 0);
  const sumEventLoop = metrics.reduce((sum, m) => sum + m.eventLoopLagMs, 0);
  const sumGcPause = metrics.reduce((sum, m) => sum + m.gcPauseTimeMs, 0);
  const sumGcFreq = metrics.reduce((sum, m) => sum + m.gcFrequency, 0);
  const sumHandles = metrics.reduce((sum, m) => sum + m.activeHandles, 0);
  const sumRequests = metrics.reduce((sum, m) => sum + m.activeRequests, 0);

  const timestamps = metrics.map((m) => new Date(m.timestamp).getTime());
  const firstSeenAt = new Date(Math.min(...timestamps)).toISOString();
  const lastSeenAt = new Date(Math.max(...timestamps)).toISOString();

  return {
    identity,
    avgCpuUsage: sumCpu / metrics.length,
    avgHeapUsedMB: sumHeapUsed / metrics.length,
    avgHeapUtilization: (sumHeapUsed / sumHeapLimit) * 100,
    avgEventLoopLagMs: sumEventLoop / metrics.length,
    avgGcPauseTimeMs: sumGcPause / metrics.length,
    avgGcFrequency: sumGcFreq / metrics.length,
    avgActiveHandles: sumHandles / metrics.length,
    avgActiveRequests: sumRequests / metrics.length,
    sampleCount: metrics.length,
    firstSeenAt,
    lastSeenAt,
  };
}

export function detectRuntimeRegression(
  current: RuntimeAggregation,
  baseline: RuntimeAggregation,
  cpuThreshold: number = 0.5,
  memoryThreshold: number = 0.5,
  eventLoopThreshold: number = 0.5,
): {
  identity: any;
  currentAggregation: RuntimeAggregation;
  baselineAggregation: RuntimeAggregation;
  cpuChangePercent: number;
  memoryChangePercent: number;
  eventLoopChangePercent: number;
  severity: "warning" | "critical";
  detectedAt: string;
} | undefined {
  const cpuChange = (current.avgCpuUsage - baseline.avgCpuUsage) / baseline.avgCpuUsage;
  const memoryChange = (current.avgHeapUsedMB - baseline.avgHeapUsedMB) / baseline.avgHeapUsedMB;
  const eventLoopChange = (current.avgEventLoopLagMs - baseline.avgEventLoopLagMs) / baseline.avgEventLoopLagMs;

  const cpuRegressed = cpuChange >= cpuThreshold;
  const memoryRegressed = memoryChange >= memoryThreshold;
  const eventLoopRegressed = eventLoopChange >= eventLoopThreshold;

  if (!cpuRegressed && !memoryRegressed && !eventLoopRegressed) {
    return undefined;
  }

  const critical =
    cpuChange >= 1.0 || memoryChange >= 1.0 || eventLoopChange >= 1.0;

  return {
    identity: current.identity,
    currentAggregation: current,
    baselineAggregation: baseline,
    cpuChangePercent: cpuChange * 100,
    memoryChangePercent: memoryChange * 100,
    eventLoopChangePercent: eventLoopChange * 100,
    severity: critical ? "critical" : "warning",
    detectedAt: new Date().toISOString(),
  };
}
