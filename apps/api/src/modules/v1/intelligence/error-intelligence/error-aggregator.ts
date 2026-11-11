import type { ErrorOccurrence, ErrorAggregation, ErrorCorrelation } from "./error-intelligence.types";

/**
 * Aggregate error occurrences into summary statistics.
 */
export function aggregateErrors(occurrences: ErrorOccurrence[]): ErrorAggregation {
  if (occurrences.length === 0) {
    throw new Error("Cannot aggregate empty occurrences");
  }

  const first = occurrences[0];
  if (!first) {
    throw new Error("First occurrence is undefined");
  }

  const timestamps = occurrences.map((o) => new Date(o.timestamp).getTime());
  const durationMs = Math.max(...timestamps) - Math.min(...timestamps) || 60000; // Default to 1 minute
  const errorRate = (occurrences.length / durationMs) * 60000; // errors per minute

  const affectedUsers = new Set(occurrences.map((o) => o.userId).filter((v): v is string => Boolean(v)));
  const affectedEndpoints = new Set(occurrences.map((o) => o.endpoint).filter((v): v is string => Boolean(v)));
  const affectedServices = new Set(occurrences.map((o) => o.serviceName).filter((v): v is string => Boolean(v)));
  const affectedDeployments = new Set(occurrences.map((o) => o.deploymentId).filter((v): v is string => Boolean(v)));

  return {
    errorFingerprint: first.errorFingerprint,
    errorType: first.errorType,
    errorMessage: first.errorMessage,
    occurrenceCount: occurrences.length,
    affectedUsers: affectedUsers.size,
    affectedEndpoints: Array.from(affectedEndpoints),
    affectedServices: Array.from(affectedServices),
    affectedDeployments: Array.from(affectedDeployments),
    firstSeenAt: new Date(Math.min(...timestamps)).toISOString(),
    lastSeenAt: new Date(Math.max(...timestamps)).toISOString(),
    errorRate,
  };
}

/**
 * Detect error regression by comparing current vs baseline.
 */
export function detectErrorRegression(
  current: ErrorAggregation,
  baseline: ErrorAggregation,
  frequencyThreshold: number = 2.0,
  userImpactThreshold: number = 1.5,
): {
  errorFingerprint: string;
  currentAggregation: ErrorAggregation;
  baselineAggregation: ErrorAggregation;
  frequencyChangePercent: number;
  userImpactChangePercent: number;
  severity: "warning" | "critical";
  detectedAt: string;
} | undefined {
  const frequencyChange = current.occurrenceCount / baseline.occurrenceCount;
  const userImpactChange = baseline.affectedUsers > 0 
    ? current.affectedUsers / baseline.affectedUsers 
    : current.affectedUsers > 0 ? 1 : 0;

  if (frequencyChange < frequencyThreshold && userImpactChange < userImpactThreshold) {
    return undefined;
  }

  const severity = frequencyChange >= 5 || userImpactChange >= 3 ? "critical" : "warning";

  return {
    errorFingerprint: current.errorFingerprint,
    currentAggregation: current,
    baselineAggregation: baseline,
    frequencyChangePercent: (frequencyChange - 1) * 100,
    userImpactChangePercent: (userImpactChange - 1) * 100,
    severity,
    detectedAt: new Date().toISOString(),
  };
}

/**
 * Correlate errors with traces, deployments, dependencies, and infrastructure.
 */
export function correlateError(
  occurrences: ErrorOccurrence[],
): ErrorCorrelation {
  const first = occurrences[0];
  if (!first) {
    throw new Error("Cannot correlate empty occurrences");
  }

  const correlatedTraces = new Set(occurrences.map((o) => o.traceId).filter((v): v is string => Boolean(v)));
  const correlatedDeployments = new Set(occurrences.map((o) => o.deploymentId).filter((v): v is string => Boolean(v)));
  const correlatedEndpoints = new Set(occurrences.map((o) => o.endpoint).filter((v): v is string => Boolean(v)));
  const correlatedServices = new Set(occurrences.map((o) => o.serviceName).filter((v): v is string => Boolean(v)));
  const correlatedHosts = new Set(occurrences.map((o) => o.hostId).filter((v): v is string => Boolean(v)));

  // Calculate correlation strength based on variety of correlations
  const correlationStrength = Math.min(
    1,
    (correlatedTraces.size + correlatedDeployments.size + correlatedEndpoints.size) / 10,
  );

  return {
    errorFingerprint: first.errorFingerprint,
    correlatedTraces: Array.from(correlatedTraces),
    correlatedDeployments: Array.from(correlatedDeployments),
    correlatedDependencies: Array.from(correlatedEndpoints),
    correlatedInfrastructure: Array.from(correlatedHosts),
    correlationStrength,
  };
}
