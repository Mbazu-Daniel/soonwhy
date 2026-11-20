export interface TelemetryRange {
  from: string;
  to: string;
  startTimestamp: number;
  endTimestamp: number;
}

export interface TelemetryQuery {
  orgId: string;
  projectId: string;
  from: string;
  to: string;
  filters?: string[];
}
