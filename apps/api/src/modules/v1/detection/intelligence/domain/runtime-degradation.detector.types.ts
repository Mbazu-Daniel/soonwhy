import { createTelemetryIdentity } from "@soonwhy/shared";

export type RuntimeFamily =
  | "cpu"
  | "memory"
  | "event_loop"
  | "event_loop_delay";

export interface RuntimeMetricSample {
  timestamp: string;
  service: string;
  name: string;
  value: number;
}

export interface RuntimeCandidate {
  serviceName: string;
  metricName: string;
  family: RuntimeFamily;
  unit: string;
  signal: {
    sampleCount: number;
    p50: number;
    p95: number;
    p99: number;
    threshold: number;
    severity: "warning" | "critical";
    baselineP95?: number;
    p95ChangePercent?: number;
  };
  samples: RuntimeMetricSample[];
  identity: ReturnType<typeof createTelemetryIdentity>;
  recommendation: string;
}

export interface RuntimeMetricSpec {
  family: RuntimeFamily;
  names: readonly string[];
  warning: number;
  critical: number;
  unit: string;
}
