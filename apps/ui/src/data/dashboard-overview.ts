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
}

export const dashboardOverview: DashboardOverview = {
  score: 86,
  errorRate: 1.4,
  requestRate: 12.6,
  avgLatency: 148,
  totalRequests: 18420,
  latencyP50: 92,
  latencyP95: 240,
  latencyP99: 410,
  statusCodes: [
    { code: 200, label: '2xx', count: 17002, percentage: 92.3 },
    { code: 300, label: '3xx', count: 1160, percentage: 6.3 },
    { code: 400, label: '4xx', count: 184, percentage: 1 },
    { code: 500, label: '5xx', count: 74, percentage: 0.4 },
  ],
};
