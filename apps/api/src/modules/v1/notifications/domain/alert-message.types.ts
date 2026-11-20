export type AlertMessageInput = {
  ruleName: string;
  severity: string;
  metric: string;
  operator: string;
  description?: string;
  value: unknown;
  threshold: unknown;
  window?: string;
  firedAt: Date;
  projectName?: string;
  failingRoutes?: { route: string; failures: number }[];
  findingUrl?: string;
};

export type AlertMessage = {
  title: string;
  body: string;
  htmlBody: string;
};

export type MetricPresentation = {
  label: string;
  unit: string;
  decimals: number;
};
