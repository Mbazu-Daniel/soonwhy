export interface DatabaseConnectionPoolSample {
  timestamp: string;
  service: string;
  poolName: string;
  usedConnections?: number;
  maxConnections?: number;
  pendingRequests?: number;
  connectionTimeouts?: number;
}

export interface DatabaseConnectionPoolThresholds {
  minimumSamples: number;
  minimumUtilization: number;
  minimumPendingRequests: number;
  minimumTimeouts: number;
}

export interface DatabaseConnectionPoolSignal {
  sampleCount: number;
  severity?: "warning" | "critical";
  p95UtilizationPercent?: number;
  p95PendingRequests?: number;
  timeoutIncrease?: number;
}

export interface DatabaseConnectionPoolCandidate {
  serviceName: string;
  poolName: string;
  signal: DatabaseConnectionPoolSignal;
  samples: DatabaseConnectionPoolSample[];
}
