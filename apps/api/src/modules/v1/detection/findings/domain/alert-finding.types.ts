export type AlertFindingInput = {
  orgId: string;
  projectId: string;
  ruleId: string;
  ruleName: string;
  ruleSeverity: string;
  metric: string;
  operator: string;
  description?: string;
  value: unknown;
  threshold: unknown;
  at: Date;
  category?: "error" | "performance" | "security" | "vulnerability" | null;
};
