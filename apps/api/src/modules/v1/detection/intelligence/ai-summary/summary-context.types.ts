export interface OverviewStats {
  totalRequests: number;
  errorRate: number;
  latencyP95: number;
  latencyP99: number;
}

export interface SummaryFinding {
  severity: string;
  title: string;
  serviceName: string;
  detectedAt: Date | string;
}

export interface SummaryContext {
  overview: OverviewStats;
  findings: SummaryFinding[];
  openIncidents: number;
}

export interface SummaryStats {
  hasTelemetry: boolean;
  requests: number;
  errorRate: number;
  latencyP95: number;
  latencyP99: number;
  totalFindings: number;
  critical: number;
  warning: number;
  other: number;
  topFinding: string | null;
  openIncidents: number;
}
