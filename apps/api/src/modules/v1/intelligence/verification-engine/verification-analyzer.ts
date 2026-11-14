import type {
  MetricSnapshot,
  VerificationRequest,
  VerificationResult,
  MetricComparison,
  VerificationSummary,
  RegressionCheck,
  RecommendationVerification,
  MetricExpectation,
} from "./verification-engine.types";
import { randomUUID } from "node:crypto";

export function verifyChange(request: VerificationRequest): VerificationResult {
  const metricComparisons = compareMetrics(
    request.beforeMetrics,
    request.afterMetrics,
    request.targetMetrics,
    request.expectations,
  );

  const summary = summarizeComparisons(metricComparisons);
  const overallScore = calculateOverallScore(summary);

  const status = determineStatus(summary, overallScore);

  return {
    verificationId: randomUUID(),
    changeId: request.changeId,
    changeType: request.changeType,
    status,
    overallScore,
    metricComparisons,
    summary,
    timestamp: new Date().toISOString(),
  };
}

export function checkRegression(
  metric: string,
  beforeBaseline: number,
  currentValue: number,
  threshold: number = 0.2,
): RegressionCheck {
  const changePercent = ((currentValue - beforeBaseline) / beforeBaseline) * 100;
  const isRegression = changePercent > threshold * 100;

  let severity: "low" | "medium" | "high" | "critical" = "low";
  if (changePercent > threshold * 100 * 3) severity = "critical";
  else if (changePercent > threshold * 100 * 2) severity = "high";
  else if (changePercent > threshold * 100) severity = "medium";

  return {
    checkId: randomUUID(),
    metric,
    beforeBaseline,
    currentValue,
    changePercent,
    threshold: threshold * 100,
    isRegression,
    severity,
    timestamp: new Date().toISOString(),
  };
}

export function verifyRecommendation(
  recommendationId: string,
  expectedSignal: RecommendationVerification["expectedSignal"],
  beforeValue: number,
  afterValue: number,
): RecommendationVerification {
  const changePercent = ((afterValue - beforeValue) / beforeValue) * 100;

  const improvementMatch = expectedSignal.improvement.match(/(\d+)/);
  const expectedImprovement = improvementMatch?.[1] ? parseInt(improvementMatch[1], 10) : 0;

  const isImprovementDirection = expectedSignal.improvement.toLowerCase().includes("reduction");
  const actualImprovement = isImprovementDirection ? -changePercent : changePercent;

  const achieved = actualImprovement >= expectedImprovement * 0.5;
  const matchPercent = Math.min((actualImprovement / expectedImprovement) * 100, 100);

  return {
    recommendationId,
    expectedSignal,
    actualSignal: {
      metric: expectedSignal.metric,
      before: beforeValue,
      after: afterValue,
      changePercent,
    },
    achieved,
    matchPercent: Math.max(matchPercent, 0),
    timestamp: new Date().toISOString(),
  };
}

function compareMetrics(
  before: MetricSnapshot,
  after: MetricSnapshot,
  targetMetrics?: string[],
  expectations?: MetricExpectation[],
): MetricComparison[] {
  const comparisons: MetricComparison[] = [];

  const metricsToCompare = targetMetrics || Object.keys(before.metrics);

  for (const metric of metricsToCompare) {
    const beforeValue = before.metrics[metric];
    const afterValue = after.metrics[metric];

    if (beforeValue === undefined || afterValue === undefined) continue;

    const changePercent = ((afterValue - beforeValue) / beforeValue) * 100;
    const changeDirection = determineChangeDirection(changePercent);
    const status = determineMetricStatus(changePercent, expectations, metric);
    const significance = determineSignificance(Math.abs(changePercent));
    const expectation = expectations?.find((e) => e.metric === metric);

    comparisons.push({
      metric,
      beforeValue,
      afterValue,
      changePercent,
      changeDirection,
      status,
      significance,
      expectation,
    });
  }

  return comparisons;
}

function determineChangeDirection(changePercent: number): "improved" | "degraded" | "stable" {
  if (Math.abs(changePercent) < 5) return "stable";
  return changePercent < 0 ? "improved" : "degraded";
}

function determineMetricStatus(
  changePercent: number,
  expectations?: MetricExpectation[],
  metric?: string,
): "pass" | "fail" | "warn" {
  const expectation = expectations?.find((e) => e.metric === metric);

  if (!expectation) {
    if (Math.abs(changePercent) > 30) return "warn";
    return "pass";
  }

  const threshold = expectation.threshold || 20;

  switch (expectation.direction) {
    case "improve":
      if (changePercent < -threshold) return "pass";
      if (changePercent > threshold) return "fail";
      return "warn";
    case "degrade":
      if (changePercent > threshold) return "pass";
      if (changePercent < -threshold) return "fail";
      return "warn";
    case "stable":
      if (Math.abs(changePercent) < threshold) return "pass";
      if (Math.abs(changePercent) > threshold * 2) return "fail";
      return "warn";
    default:
      return "pass";
  }
}

function determineSignificance(changePercent: number): "high" | "medium" | "low" {
  if (Math.abs(changePercent) > 50) return "high";
  if (Math.abs(changePercent) > 20) return "medium";
  return "low";
}

function summarizeComparisons(comparisons: MetricComparison[]): VerificationSummary {
  const totalMetrics = comparisons.length;
  const passed = comparisons.filter((c) => c.status === "pass").length;
  const failed = comparisons.filter((c) => c.status === "fail").length;
  const warned = comparisons.filter((c) => c.status === "warn").length;
  const improved = comparisons.filter((c) => c.changeDirection === "improved").length;
  const degraded = comparisons.filter((c) => c.changeDirection === "degraded").length;

  const keyInsights = generateKeyInsights(comparisons);
  const recommendations = generateRecommendations(comparisons);

  return {
    totalMetrics,
    passed,
    failed,
    warned,
    improved,
    degraded,
    keyInsights,
    recommendations,
  };
}

function generateKeyInsights(comparisons: MetricComparison[]): string[] {
  const insights: string[] = [];

  const highSignificance = comparisons.filter((c) => c.significance === "high");
  if (highSignificance.length > 0) {
    insights.push(
      `${highSignificance.length} metric(s) showed significant changes (>50% shift)`,
    );
  }

  const failures = comparisons.filter((c) => c.status === "fail");
  if (failures.length > 0) {
    insights.push(
      `${failures.length} metric(s) failed to meet expectations`,
    );
  }

  const improved = comparisons.filter((c) => c.changeDirection === "improved");
  if (improved.length > comparisons.length / 2) {
    insights.push("Majority of metrics showed improvement");
  }

  const degraded = comparisons.filter((c) => c.changeDirection === "degraded");
  if (degraded.length > comparisons.length / 2) {
    insights.push("Majority of metrics showed degradation");
  }

  if (insights.length === 0) {
    insights.push("All metrics remained within expected ranges");
  }

  return insights;
}

function generateRecommendations(comparisons: MetricComparison[]): string[] {
  const recommendations: string[] = [];

  const failures = comparisons.filter((c) => c.status === "fail");
  for (const failure of failures) {
    if (failure.changeDirection === "degraded") {
      recommendations.push(
        `Investigate ${failure.metric} - degraded by ${Math.abs(failure.changePercent).toFixed(0)}%`,
      );
    } else {
      recommendations.push(
        `Review ${failure.metric} - change exceeded expectation threshold`,
      );
    }
  }

  const warnings = comparisons.filter((c) => c.status === "warn" && c.significance === "high");
  for (const warning of warnings) {
    recommendations.push(
      `Monitor ${warning.metric} - significant change of ${warning.changePercent.toFixed(0)}%`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("No immediate action required - change verified successfully");
  }

  return recommendations;
}

function calculateOverallScore(summary: VerificationSummary): number {
  if (summary.totalMetrics === 0) return 0;

  const passWeight = 1;
  const warnWeight = 0.5;
  const failWeight = 0;

  const score =
    (summary.passed * passWeight +
      summary.warned * warnWeight +
      summary.failed * failWeight) /
    summary.totalMetrics;

  return Math.round(score * 100);
}

function determineStatus(summary: VerificationSummary, overallScore: number): "verified" | "failed" | "inconclusive" {
  if (summary.failed > 0) return "failed";
  if (overallScore >= 80) return "verified";
  if (overallScore >= 50) return "inconclusive";
  return "failed";
}
