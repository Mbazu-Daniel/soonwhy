export interface DatabaseConnectionWaitSample {
  timestamp: string;
  service: string;
  poolName: string;
  waitTimeMs: number;
}

export interface DatabaseConnectionWaitThresholds {
  minimumSamples: number;
  warningP95WaitMs: number;
  criticalP95WaitMs: number;
  regressionPercent: number;
}

export interface DatabaseConnectionWaitSignal {
  sampleCount: number;
  severity: "warning" | "critical";
  p50WaitMs: number;
  p95WaitMs: number;
  p99WaitMs: number;
  baselineP95WaitMs?: number;
  p95ChangePercent?: number;
  regressionDetected: boolean;
}

export interface DatabaseConnectionWaitCandidate {
  serviceName: string;
  poolName: string;
  signal: DatabaseConnectionWaitSignal;
  samples: DatabaseConnectionWaitSample[];
}
