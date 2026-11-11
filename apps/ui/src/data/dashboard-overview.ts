export interface DashboardOverview {
  score: number;
  errorRate: number;
  requestRate: number;
  avgLatency: number;
  totalRequests: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  statusCodes: { code: number; label: string; count: number; percentage: number }[];
  timeSeries?: { timestamp: number; count: number; normalizedHeight: number }[];
  from?: string;
  to?: string;
}

export const dashboardOverview: DashboardOverview = {
  score: 0,
  errorRate: 0,
  requestRate: 0,
  avgLatency: 0,
  totalRequests: 0,
  latencyP50: 0,
  latencyP95: 0,
  latencyP99: 0,
  statusCodes: [],
  timeSeries: [],
};
