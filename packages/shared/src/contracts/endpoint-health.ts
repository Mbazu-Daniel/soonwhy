export type Grade = "A" | "B" | "C" | "D" | "F";

export type TrendStatus = "regressing" | "improving" | "steady" | "new";

export type EndpointTrend = {
  status: TrendStatus;
  p95ChangePct: number | null;
  errorRateChange: number | null;
  countChangePct: number | null;
};

export type EndpointHealth = {
  url: string;
  method: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  score: number;
  grade: Grade;
  trend: EndpointTrend;
};

export type ProjectHealth = { score: number | null; grade: Grade | null; endpoints: EndpointHealth[] };

export type EndpointHealthResponse = ProjectHealth & { from: string; to: string };
