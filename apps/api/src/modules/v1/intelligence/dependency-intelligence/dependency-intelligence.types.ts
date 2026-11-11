import type { TelemetryIdentity } from "../telemetry-identity.types";

export interface DependencyCall {
  fromService: string;
  toService: string;
  dependencyType: "http" | "grpc" | "redis" | "kafka" | "nats" | "database";
  latencyMs: number;
  error?: string;
  timestamp: string;
}

export interface DependencyAggregation {
  identity: TelemetryIdentity;
  avgLatencyMs: number;
  errorRate: number;
  callCount: number;
}
