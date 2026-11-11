export type DependencyStatus = "ok" | "unavailable";

export interface DependencyCheck {
  status: DependencyStatus;
  latencyMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface ReadinessReport {
  status: "ok" | "degraded";
  timestamp: string;
  dependencies: {
    database: DependencyCheck;
    redis: DependencyCheck;
    quickwit: DependencyCheck;
  };
}
