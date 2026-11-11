import {
  createTelemetryIdentity,
  fingerprintDependency,
} from "@soonwhy/shared";
import type {
  LatencyFinding,
  ResourceFinding,
  PerformanceDetectionConfig,
} from "./performance-detection.types";

const DEFAULT_CONFIG: PerformanceDetectionConfig = {
  minimumSamples: 20,
  latencyWarningAbsoluteMs: 250,
  latencyWarningRelative: 0.5,
  latencyCriticalRelative: 1,
  throughputWarningDecrease: 0.3,
  throughputCriticalDecrease: 0.5,
  spanWarningContribution: 0.5,
  spanCriticalContribution: 0.75,
  cpuWarningThreshold: 70,
  cpuCriticalThreshold: 90,
  memoryWarningThreshold: 70,
  memoryCriticalThreshold: 90,
  eventLoopWarningMs: 50,
  eventLoopCriticalMs: 100,
};

/**
 * Detect lock/wait time issues.
 *
 * Flags when database locks, mutex waits, or other synchronization
 * primitives cause significant wait times.
 */
export function detectLockWaitTime(
  waitTimeMs: number,
  lockType: "database_lock" | "mutex" | "semaphore" | "file_lock",
  resourceName?: string,
  serviceName?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): LatencyFinding | undefined {
  if (waitTimeMs < 100) return undefined; // Ignore short waits

  const severity = waitTimeMs >= 1000 ? "critical" : "warning";

  const identity = createTelemetryIdentity({
    domain: "database",
    serviceName,
    operationName: lockType,
    resourceName,
    identityAttributes: {
      lockType,
      waitTime: waitTimeMs,
    },
  });

  return {
    identity,
    metric: "latency",
    observedValue: waitTimeMs,
    unit: "ms",
    severity,
    reason: `Lock wait time of ${waitTimeMs.toFixed(1)}ms indicates contention.`,
    detectedAt: new Date().toISOString(),
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: 1,
    },
    ...(serviceName ? { serviceName } : {}),
    ...(resourceName ? { resourceName } : {}),
  };
}

/**
 * Detect connection pool saturation.
 *
 * Flags when connection pools (database, HTTP, Redis) are near capacity,
 * indicating resource exhaustion that may cause requests to wait or fail.
 */
export function detectConnectionPoolSaturation(
  poolMetrics: {
    activeConnections: number;
    totalConnections: number;
    maxConnections: number;
    waitingCount?: number;
  },
  poolType: "database" | "http" | "redis" | "grpc",
  poolName: string,
  serviceName?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): ResourceFinding | undefined {
  const utilization = poolMetrics.activeConnections / poolMetrics.maxConnections;

  if (utilization < 0.7) return undefined; // Below warning threshold

  const severity = utilization >= 0.9 ? "critical" : "warning";

  const identity = createTelemetryIdentity({
    domain: "infrastructure",
    serviceName,
    operationName: poolType,
    resourceName: poolName,
    identityAttributes: {
      poolType,
      poolName,
      utilization: utilization * 100,
    },
  });

  const reason = poolMetrics.waitingCount && poolMetrics.waitingCount > 0
    ? `Connection pool at ${(utilization * 100).toFixed(1)}% capacity with ${poolMetrics.waitingCount} requests waiting.`
    : `Connection pool at ${(utilization * 100).toFixed(1)}% capacity.`;

  return {
    identity,
    metric: "connection_pool",
    observedValue: utilization * 100,
    unit: "%",
    severity,
    reason,
    detectedAt: new Date().toISOString(),
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: 1,
    },
    ...(serviceName ? { serviceName } : {}),
  };
}

/**
 * Detect GC pressure (Node.js specific).
 *
 * Flags when garbage collection pauses are frequent or long,
 * indicating memory allocation patterns that may cause performance issues.
 */
export function detectGcPressure(
  gcMetrics: {
    pauseTimeMs: number;
    frequency: number; // pauses per second
    heapSizeMB: number;
    heapLimitMB: number;
  },
  serviceName?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): ResourceFinding | undefined {
  const heapUtilization = gcMetrics.heapSizeMB / gcMetrics.heapLimitMB;

  // Check for long GC pauses
  if (gcMetrics.pauseTimeMs >= 100) {
    const identity = createTelemetryIdentity({
      domain: "runtime",
      serviceName,
      identityAttributes: {
        resourceType: "gc",
        pauseTime: gcMetrics.pauseTimeMs,
      },
    });

    return {
      identity,
      metric: "event_loop",
      observedValue: gcMetrics.pauseTimeMs,
      unit: "ms",
      severity: "critical",
      reason: `GC pause of ${gcMetrics.pauseTimeMs.toFixed(1)}ms indicates memory pressure.`,
      detectedAt: new Date().toISOString(),
      evidence: {
        window: {
          start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        samples: 1,
      },
      ...(serviceName ? { serviceName } : {}),
    };
  }

  // Check for high GC frequency
  if (gcMetrics.frequency >= 10) {
    const identity = createTelemetryIdentity({
      domain: "runtime",
      serviceName,
      identityAttributes: {
        resourceType: "gc",
        frequency: gcMetrics.frequency,
      },
    });

    return {
      identity,
      metric: "event_loop",
      observedValue: gcMetrics.frequency,
      unit: "pauses/sec",
      severity: "warning",
      reason: `GC frequency of ${gcMetrics.frequency.toFixed(1)}/sec indicates allocation pressure.`,
      detectedAt: new Date().toISOString(),
      evidence: {
        window: {
          start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        samples: 1,
      },
      ...(serviceName ? { serviceName } : {}),
    };
  }

  // Check for high heap utilization
  if (heapUtilization >= 0.8) {
    const identity = createTelemetryIdentity({
      domain: "runtime",
      serviceName,
      identityAttributes: {
        resourceType: "heap",
        utilization: heapUtilization * 100,
      },
    });

    return {
      identity,
      metric: "memory",
      observedValue: heapUtilization * 100,
      unit: "%",
      severity: heapUtilization >= 0.9 ? "critical" : "warning",
      reason: `Heap utilization at ${(heapUtilization * 100).toFixed(1)}% indicates memory pressure.`,
      detectedAt: new Date().toISOString(),
      evidence: {
        window: {
          start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        samples: 1,
      },
      ...(serviceName ? { serviceName } : {}),
    };
  }

  return undefined;
}
