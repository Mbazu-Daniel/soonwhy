export interface WeeklySummaryProject {
  projectId: string;
  orgId: string;
}

export interface WeeklySummaryDispatchInput {
  orgId: string;
  projectId: string;
  incidentId: string;
  severity: string;
  title: string;
  body: string;
  htmlBody?: string;
  metadata: Record<string, unknown>;
}

export interface WeeklySummaryDispatchResult {
  sent: number;
  failed: number;
  results: { projectId: string; orgId: string; sent: number; failed: number; results: unknown[] }[];
}

export interface WeeklySummaryServiceDeps {
  getProjectsWithActiveChannels: () => Promise<WeeklySummaryProject[]>;
  dispatchAlert: (input: WeeklySummaryDispatchInput) => Promise<WeeklySummaryDispatchResult>;
}
