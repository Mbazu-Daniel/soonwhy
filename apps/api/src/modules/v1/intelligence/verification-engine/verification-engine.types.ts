import type { TelemetryIdentity } from "@soonwhy/shared";

export interface MetricSnapshot {
  timestamp: string;
  metrics: Record<string, number>;
  count: number;
}

export interface VerificationRequest {
  changeId: string;
  changeType: "deployment" | "configuration" | "code" | "infrastructure";
  beforeMetrics: MetricSnapshot;
  afterMetrics: MetricSnapshot;
  targetMetrics?: string[];
  timeWindow: {
    beforeStart: string;
    beforeEnd: string;
    afterStart: string;
    afterEnd: string;
  };
  expectations?: MetricExpectation[];
}

export interface MetricExpectation {
  metric: string;
  direction: "improve" | "degrade" | "stable";
  threshold?: number;
}

export interface VerificationResult {
  verificationId: string;
  changeId: string;
  changeType: string;
  status: "verified" | "failed" | "inconclusive";
  overallScore: number;
  metricComparisons: MetricComparison[];
  summary: VerificationSummary;
  timestamp: string;
}

export interface MetricComparison {
  metric: string;
  beforeValue: number;
  afterValue: number;
  changePercent: number;
  changeDirection: "improved" | "degraded" | "stable";
  status: "pass" | "fail" | "warn";
  significance: "high" | "medium" | "low";
  expectation?: MetricExpectation;
}

export interface VerificationSummary {
  totalMetrics: number;
  passed: number;
  failed: number;
  warned: number;
  improved: number;
  degraded: number;
  keyInsights: string[];
  recommendations: string[];
}

export interface RegressionCheck {
  checkId: string;
  metric: string;
  beforeBaseline: number;
  currentValue: number;
  changePercent: number;
  threshold: number;
  isRegression: boolean;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: string;
}

export interface RecommendationVerification {
  recommendationId: string;
  expectedSignal: {
    metric: string;
    before: string;
    after: string;
    improvement: string;
  };
  actualSignal: {
    metric: string;
    before: number;
    after: number;
    changePercent: number;
  };
  achieved: boolean;
  matchPercent: number;
  timestamp: string;
}
