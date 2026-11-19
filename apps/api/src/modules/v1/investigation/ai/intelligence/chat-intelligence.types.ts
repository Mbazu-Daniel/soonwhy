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

export interface ChatResponse {
  id: string;
  role: "assistant";
  content: string;
  timestamp: Date;
  suggestions?: string[];
  relatedEntities?: {
    detections?: Array<{ id: string; type: string; severity: string }>;
    slos?: Array<{ id: string; target: number; status: string }>;
  };
}

export type UserIntent =
  | "detect_anomaly_details"
  | "slo_burn_rate_status"
  | "change_point_analysis"
  | "detection_recommendations"
  | "general_health"
  | "unknown";
