import {
  createTelemetryIdentity,
  fingerprintHost,
} from "@soonwhy/shared";
import type {
  RuntimeMetrics,
  RuntimeFinding,
} from "./runtime-intelligence.types";

const CONFIG = {
  cpuWarning: 70,
  cpuCritical: 90,
  memoryWarning: 70,
  memoryCritical: 90,
  eventLoopWarning: 50,
  eventLoopCritical: 100,
  gcPauseWarning: 50,
  gcPauseCritical: 100,
  gcFrequencyWarning: 10,
  handlesWarning: 1000,
  requestsWarning: 1000,
};

export function detectCpuSpike(
  metrics: RuntimeMetrics,
): RuntimeFinding | undefined {
  if (metrics.cpuUsagePercent < CONFIG.cpuWarning) return undefined;

  const severity =
    metrics.cpuUsagePercent >= CONFIG.cpuCritical ? "critical" : "warning";

  const identity = createTelemetryIdentity({
    domain: "runtime",
    serviceName: metrics.serviceName,
    hostId: metrics.hostId,
    containerId: metrics.containerId,
    processId: metrics.processId,
    identityAttributes: { resourceType: "cpu" },
  });

  return {
    identity,
    metric: "cpu",
    observedValue: metrics.cpuUsagePercent,
    unit: "%",
    severity,
    reason: `CPU usage at ${metrics.cpuUsagePercent.toFixed(1)}% indicates high load.`,
    detectedAt: metrics.timestamp,
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: 1,
    },
  };
}

export function detectMemoryPressure(
  metrics: RuntimeMetrics,
): RuntimeFinding | undefined {
  const heapUtilization = (metrics.heapUsedMB / metrics.heapLimitMB) * 100;

  if (heapUtilization < CONFIG.memoryWarning) return undefined;

  const severity =
    heapUtilization >= CONFIG.memoryCritical ? "critical" : "warning";

  const identity = createTelemetryIdentity({
    domain: "runtime",
    serviceName: metrics.serviceName,
    hostId: metrics.hostId,
    containerId: metrics.containerId,
    processId: metrics.processId,
    identityAttributes: { resourceType: "memory" },
  });

  return {
    identity,
    metric: "memory",
    observedValue: heapUtilization,
    unit: "%",
    severity,
    reason: `Heap utilization at ${heapUtilization.toFixed(1)}% (${metrics.heapUsedMB.toFixed(1)}MB / ${metrics.heapLimitMB}MB).`,
    detectedAt: metrics.timestamp,
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: 1,
    },
  };
}

export function detectEventLoopLag(
  metrics: RuntimeMetrics,
): RuntimeFinding | undefined {
  if (metrics.eventLoopLagMs < CONFIG.eventLoopWarning) return undefined;

  const severity =
    metrics.eventLoopLagMs >= CONFIG.eventLoopCritical ? "critical" : "warning";

  const identity = createTelemetryIdentity({
    domain: "runtime",
    serviceName: metrics.serviceName,
    hostId: metrics.hostId,
    containerId: metrics.containerId,
    processId: metrics.processId,
    identityAttributes: { resourceType: "event_loop" },
  });

  return {
    identity,
    metric: "event_loop",
    observedValue: metrics.eventLoopLagMs,
    unit: "ms",
    severity,
    reason: `Event loop lag of ${metrics.eventLoopLagMs.toFixed(1)}ms indicates main thread blocking.`,
    detectedAt: metrics.timestamp,
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: 1,
    },
  };
}

export function detectGcPressure(
  metrics: RuntimeMetrics,
): RuntimeFinding | undefined {
  if (metrics.gcPauseTimeMs >= CONFIG.gcPauseWarning) {
    const severity =
      metrics.gcPauseTimeMs >= CONFIG.gcPauseCritical ? "critical" : "warning";

    const identity = createTelemetryIdentity({
      domain: "runtime",
      serviceName: metrics.serviceName,
      hostId: metrics.hostId,
      containerId: metrics.containerId,
      processId: metrics.processId,
      identityAttributes: { resourceType: "gc" },
    });

    return {
      identity,
      metric: "gc",
      observedValue: metrics.gcPauseTimeMs,
      unit: "ms",
      severity,
      reason: `GC pause of ${metrics.gcPauseTimeMs.toFixed(1)}ms indicates memory pressure.`,
      detectedAt: metrics.timestamp,
      evidence: {
        window: {
          start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        samples: 1,
      },
    };
  }

  if (metrics.gcFrequency >= CONFIG.gcFrequencyWarning) {
    const identity = createTelemetryIdentity({
      domain: "runtime",
      serviceName: metrics.serviceName,
      hostId: metrics.hostId,
      containerId: metrics.containerId,
      processId: metrics.processId,
      identityAttributes: { resourceType: "gc" },
    });

    return {
      identity,
      metric: "gc",
      observedValue: metrics.gcFrequency,
      unit: "pauses/sec",
      severity: "warning",
      reason: `GC frequency of ${metrics.gcFrequency.toFixed(1)}/sec indicates allocation pressure.`,
      detectedAt: metrics.timestamp,
      evidence: {
        window: {
          start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        samples: 1,
      },
    };
  }

  return undefined;
}

export function detectResourceExhaustion(
  metrics: RuntimeMetrics,
): RuntimeFinding | undefined {
  const findings: RuntimeFinding[] = [];

  if (metrics.activeHandles >= CONFIG.handlesWarning) {
    const identity = createTelemetryIdentity({
      domain: "runtime",
      serviceName: metrics.serviceName,
      hostId: metrics.hostId,
      containerId: metrics.containerId,
      processId: metrics.processId,
      identityAttributes: { resourceType: "handles" },
    });

    findings.push({
      identity,
      metric: "handles",
      observedValue: metrics.activeHandles,
      unit: "count",
      severity: "warning",
      reason: `Active handles at ${metrics.activeHandles} indicates potential resource leak.`,
      detectedAt: metrics.timestamp,
      evidence: {
        window: {
          start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        samples: 1,
      },
    });
  }

  if (metrics.activeRequests >= CONFIG.requestsWarning) {
    const identity = createTelemetryIdentity({
      domain: "runtime",
      serviceName: metrics.serviceName,
      hostId: metrics.hostId,
      containerId: metrics.containerId,
      processId: metrics.processId,
      identityAttributes: { resourceType: "requests" },
    });

    findings.push({
      identity,
      metric: "requests",
      observedValue: metrics.activeRequests,
      unit: "count",
      severity: "warning",
      reason: `Active requests at ${metrics.activeRequests} indicates concurrency pressure.`,
      detectedAt: metrics.timestamp,
      evidence: {
        window: {
          start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        samples: 1,
      },
    });
  }

  return findings[0];
}
