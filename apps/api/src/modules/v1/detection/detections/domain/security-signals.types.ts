export type AuthFailureCount = { service: string; count: number };

export type AuthFailureSpike = {
  service: string;
  count: number;
  baseline: number;
  severity: "warning" | "critical";
};

export type SecretExposure = {
  service: string;
  kind: string;
  count: number;
  samples: string[];
};

export type LogLine = { service: string; message: string };
