import {
  createTelemetryIdentity,
  fingerprintHost,
} from "@soonwhy/shared";
import type {
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
 * Detect CPU saturation.
 *
 * Flags when CPU usage exceeds warning or critical thresholds,
 * indicating resource exhaustion that may cause performance degradation.
 */
export function detectCpuSaturation(
  cpuUsagePercent: number,
  hostId?: string,
  containerId?: string,
  processId?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): ResourceFinding | undefined {
  if (cpuUsagePercent < config.cpuWarningThreshold) return undefined;

  const severity =
    cpuUsagePercent >= config.cpuCriticalThreshold ? "critical" : "warning";

  const identity = createTelemetryIdentity({
    domain: "infrastructure",
    hostId,
    containerId,
    processId,
    identityAttributes: {
      resourceType: "cpu",
    },
  });

  return {
    identity,
    metric: "cpu",
    observedValue: cpuUsagePercent,
    unit: "%",
    severity,
    reason: `CPU usage at ${cpuUsagePercent.toFixed(1)}% indicates resource saturation.`,
    detectedAt: new Date().toISOString(),
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: 1,
    },
    hostId,
    containerId,
    processId,
  };
}

/**
 * Detect memory pressure.
 *
 * Flags when memory usage exceeds warning or critical thresholds,
 * which may lead to OOM kills or GC pressure.
 */
export function detectMemoryPressure(
  memoryUsagePercent: number,
  hostId?: string,
  containerId?: string,
  processId?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): ResourceFinding | undefined {
  if (memoryUsagePercent < config.memoryWarningThreshold) return undefined;

  const severity =
    memoryUsagePercent >= config.memoryCriticalThreshold
      ? "critical"
      : "warning";

  const identity = createTelemetryIdentity({
    domain: "infrastructure",
    hostId,
    containerId,
    processId,
    identityAttributes: {
      resourceType: "memory",
    },
  });

  return {
    identity,
    metric: "memory",
    observedValue: memoryUsagePercent,
    unit: "%",
    severity,
    reason: `Memory usage at ${memoryUsagePercent.toFixed(1)}% indicates resource pressure.`,
    detectedAt: new Date().toISOString(),
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: 1,
    },
    hostId,
    containerId,
    processId,
  };
}

/**
 * Detect event-loop lag (Node.js specific).
 *
 * Flags when the event loop is blocked for extended periods,
 * indicating synchronous operations blocking the main thread.
 */
export function detectEventLoopLag(
  eventLoopLagMs: number,
  hostId?: string,
  containerId?: string,
  processId?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): ResourceFinding | undefined {
  if (eventLoopLagMs < config.eventLoopWarningMs) return undefined;

  const severity =
    eventLoopLagMs >= config.eventLoopCriticalMs ? "critical" : "warning";

  const identity = createTelemetryIdentity({
    domain: "runtime",
    hostId,
    containerId,
    processId,
    identityAttributes: {
      resourceType: "event_loop",
    },
  });

  return {
    identity,
    metric: "event_loop",
    observedValue: eventLoopLagMs,
    unit: "ms",
    severity,
    reason: `Event loop lag of ${eventLoopLagMs.toFixed(1)}ms indicates main thread blocking.`,
    detectedAt: new Date().toISOString(),
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: 1,
    },
    hostId,
    containerId,
    processId,
  };
}

/**
 * Detect disk I/O pressure.
 *
 * Flags when disk I/O wait times or utilization exceed thresholds,
 * indicating storage bottlenecks.
 */
export function detectDiskIoPressure(
  diskUtilizationPercent: number,
  diskWaitTimeMs?: number,
  hostId?: string,
  containerId?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): ResourceFinding | undefined {
  // Use disk wait time if available, otherwise use utilization
  const metricValue = diskWaitTimeMs ?? diskUtilizationPercent;
  const unit = diskWaitTimeMs ? "ms" : "%";
  const threshold = diskWaitTimeMs ? 100 : config.cpuWarningThreshold;

  if (metricValue < threshold) return undefined;

  const severity =
    metricValue >= threshold * 1.5 ? "critical" : "warning";

  const identity = createTelemetryIdentity({
    domain: "infrastructure",
    hostId,
    containerId,
    identityAttributes: {
      resourceType: "disk_io",
    },
  });

  return {
    identity,
    metric: "disk_io",
    observedValue: metricValue,
    unit,
    severity,
    reason: diskWaitTimeMs
      ? `Disk I/O wait time of ${diskWaitTimeMs.toFixed(1)}ms indicates storage bottleneck.`
      : `Disk I/O utilization at ${diskUtilizationPercent.toFixed(1)}% indicates pressure.`,
    detectedAt: new Date().toISOString(),
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: 1,
    },
    hostId,
    containerId,
  };
}

/**
 * Detect network I/O pressure.
 *
 * Flags when network I/O utilization or latency exceeds thresholds,
 * indicating network bottlenecks.
 */
export function detectNetworkIoPressure(
  networkUtilizationPercent: number,
  networkLatencyMs?: number,
  hostId?: string,
  containerId?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): ResourceFinding | undefined {
  // Use network latency if available, otherwise use utilization
  const metricValue = networkLatencyMs ?? networkUtilizationPercent;
  const unit = networkLatencyMs ? "ms" : "%";
  const threshold = networkLatencyMs ? 100 : config.cpuWarningThreshold;

  if (metricValue < threshold) return undefined;

  const severity =
    metricValue >= threshold * 1.5 ? "critical" : "warning";

  const identity = createTelemetryIdentity({
    domain: "infrastructure",
    hostId,
    containerId,
    identityAttributes: {
      resourceType: "network_io",
    },
  });

  return {
    identity,
    metric: "network_io",
    observedValue: metricValue,
    unit,
    severity,
    reason: networkLatencyMs
      ? `Network latency of ${networkLatencyMs.toFixed(1)}ms indicates network bottleneck.`
      : `Network I/O utilization at ${networkUtilizationPercent.toFixed(1)}% indicates pressure.`,
    detectedAt: new Date().toISOString(),
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: 1,
    },
    hostId,
    containerId,
  };
}

/**
 * Detect container resource pressure.
 *
 * Aggregates CPU, memory, and other resource metrics to detect
 * when a container is under resource pressure.
 */
export function detectContainerResourcePressure(
  metrics: {
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    cpuThrottled?: boolean;
    oomKilled?: boolean;
  },
  containerId: string,
  hostId?: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): ResourceFinding | undefined {
  // Check for critical conditions first
  if (metrics.oomKilled) {
    const identity = createTelemetryIdentity({
      domain: "infrastructure",
      hostId,
      containerId,
      identityAttributes: {
        resourceType: "memory",
        oomKilled: true,
      },
    });

    return {
      identity,
      metric: "memory",
      observedValue: metrics.memoryUsagePercent,
      unit: "%",
      severity: "critical",
      reason: "Container was OOM killed due to memory exhaustion.",
      detectedAt: new Date().toISOString(),
      evidence: {
        window: {
          start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        samples: 1,
      },
      hostId,
      containerId,
    };
  }

  if (metrics.cpuThrottled) {
    const identity = createTelemetryIdentity({
      domain: "infrastructure",
      hostId,
      containerId,
      identityAttributes: {
        resourceType: "cpu",
        cpuThrottled: true,
      },
    });

    return {
      identity,
      metric: "cpu",
      observedValue: metrics.cpuUsagePercent,
      unit: "%",
      severity: "warning",
      reason: "Container CPU is being throttled, indicating resource limits.",
      detectedAt: new Date().toISOString(),
      evidence: {
        window: {
          start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        samples: 1,
      },
      hostId,
      containerId,
    };
  }

  // Check for combined resource pressure
  const cpuPressure = metrics.cpuUsagePercent >= config.cpuWarningThreshold;
  const memoryPressure =
    metrics.memoryUsagePercent >= config.memoryWarningThreshold;

  if (cpuPressure && memoryPressure) {
    const identity = createTelemetryIdentity({
      domain: "infrastructure",
      hostId,
      containerId,
      identityAttributes: {
        resourceType: "combined",
      },
    });

    return {
      identity,
      metric: "cpu", // Primary metric
      observedValue: metrics.cpuUsagePercent,
      unit: "%",
      severity: "critical",
      reason: `Container under combined resource pressure: CPU ${metrics.cpuUsagePercent.toFixed(1)}%, Memory ${metrics.memoryUsagePercent.toFixed(1)}%.`,
      detectedAt: new Date().toISOString(),
      evidence: {
        window: {
          start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        samples: 1,
      },
      hostId,
      containerId,
    };
  }

  return undefined;
}

/**
 * Detect host resource pressure.
 *
 * Aggregates host-level resource metrics to detect when a host
 * is under resource pressure.
 */
export function detectHostResourcePressure(
  metrics: {
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    diskUtilizationPercent: number;
    networkUtilizationPercent: number;
  },
  hostId: string,
  config: PerformanceDetectionConfig = DEFAULT_CONFIG,
): ResourceFinding | undefined {
  const pressures: string[] = [];

  if (metrics.cpuUsagePercent >= config.cpuCriticalThreshold) {
    pressures.push(`CPU ${metrics.cpuUsagePercent.toFixed(1)}%`);
  }
  if (metrics.memoryUsagePercent >= config.memoryCriticalThreshold) {
    pressures.push(`Memory ${metrics.memoryUsagePercent.toFixed(1)}%`);
  }
  if (metrics.diskUtilizationPercent >= config.cpuCriticalThreshold) {
    pressures.push(`Disk ${metrics.diskUtilizationPercent.toFixed(1)}%`);
  }
  if (metrics.networkUtilizationPercent >= config.cpuCriticalThreshold) {
    pressures.push(`Network ${metrics.networkUtilizationPercent.toFixed(1)}%`);
  }

  if (pressures.length === 0) return undefined;

  const identity = createTelemetryIdentity({
    domain: "infrastructure",
    hostId,
    identityAttributes: {
      resourceType: "host",
    },
  });

  return {
    identity,
    metric: "cpu", // Primary metric
    observedValue: metrics.cpuUsagePercent,
    unit: "%",
    severity: pressures.length >= 2 ? "critical" : "warning",
    reason: `Host under resource pressure: ${pressures.join(", ")}.`,
    detectedAt: new Date().toISOString(),
    evidence: {
      window: {
        start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      samples: 1,
    },
    hostId,
  };
}
