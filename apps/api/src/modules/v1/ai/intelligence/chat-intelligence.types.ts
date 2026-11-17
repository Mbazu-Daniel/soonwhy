export type DetectionSummary = {
  severity: string;
  type: string;
  title: string;
  observedValue: number | string;
  unit: string;
  description: string;
};

export type SloSummary = {
  status: string;
  burnRate: number;
  budgetRemaining: number;
};

export type ChangePointSummary = {
  changePoints: unknown[];
  penaltyUsed: number;
};
