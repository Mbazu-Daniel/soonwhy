import type { TelemetryIdentity } from "../telemetry-identity.types";

export interface DeploymentMetrics {
  deploymentId: string;
  serviceName: string;
  version: string;
  timestamp: string;
  latencyMs?: number;
  errorRate?: number;
  throughput?: number;
}

export interface DeploymentAggregation {
  identity: TelemetryIdentity;
  avgLatencyMs: number;
  avgErrorRate: number;
  avgThroughput: number;
  sampleCount: number;
}

export interface DeploymentComparison {
  deploymentId: string;
  beforeAggregation: DeploymentAggregation;
  afterAggregation: DeploymentAggregation;
  latencyChangePercent: number;
  errorRateChangePercent: number;
  throughputChangePercent: number;
  severity: "warning" | "critical" | "improved";
}
