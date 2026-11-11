import type { TelemetryIdentity } from "../telemetry-identity.types";

export interface InfrastructureMetrics {
  hostId: string;
  containerId?: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  networkInBytes: number;
  networkOutBytes: number;
  timestamp: string;
}

export interface InfrastructureAggregation {
  identity: TelemetryIdentity;
  avgCpuUsage: number;
  avgMemoryUsage: number;
  avgDiskUsage: number;
  avgNetworkInBytes: number;
  avgNetworkOutBytes: number;
  sampleCount: number;
}
