export type ExposureSpan = {
  spanId: string;
  service: string;
  route: string;
  attributes: Record<string, unknown>;
};

export type ExposureCandidate = {
  service: string;
  route: string;
  path: string;
  severity: "warning" | "critical";
  count: number;
  spanIds: string[];
};
