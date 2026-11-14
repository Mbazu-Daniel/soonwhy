import type { TelemetryIdentity } from "../telemetry-identity.types";

export interface ErrorOccurrence {
  errorFingerprint: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  timestamp: string;
  traceId?: string;
  spanId?: string;
  serviceName?: string;
  endpoint?: string;
  deploymentId?: string;
  userId?: string;
  hostId?: string;
}

export interface ErrorAggregation {
  errorFingerprint: string;
  errorType: string;
  errorMessage: string;
  occurrenceCount: number;
  affectedUsers: number;
  affectedEndpoints: string[];
  affectedServices: string[];
  affectedDeployments: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  errorRate: number;
}

export interface ErrorCorrelation {
  errorFingerprint: string;
  correlatedTraces: string[];
  correlatedDeployments: string[];
  correlatedDependencies: string[];
  correlatedInfrastructure: string[];
  correlationStrength: number;
}

export interface ErrorRegression {
  errorFingerprint: string;
  currentAggregation: ErrorAggregation;
  baselineAggregation: ErrorAggregation;
  frequencyChangePercent: number;
  userImpactChangePercent: number;
  severity: "warning" | "critical";
  detectedAt: string;
}
