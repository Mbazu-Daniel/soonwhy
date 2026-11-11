import { Injectable } from "@nestjs/common";
import type {
  VerificationRequest,
  VerificationResult,
  RegressionCheck,
  RecommendationVerification,
} from "./verification-engine.types";
import {
  verifyChange,
  checkRegression,
  verifyRecommendation,
} from "./verification-analyzer";

@Injectable()
export class VerificationEngineService {
  verifyChange(request: VerificationRequest): VerificationResult {
    return verifyChange(request);
  }

  checkRegression(
    metric: string,
    beforeBaseline: number,
    currentValue: number,
    threshold?: number,
  ): RegressionCheck {
    return checkRegression(metric, beforeBaseline, currentValue, threshold);
  }

  verifyRecommendation(
    recommendationId: string,
    expectedSignal: RecommendationVerification["expectedSignal"],
    beforeValue: number,
    afterValue: number,
  ): RecommendationVerification {
    return verifyRecommendation(recommendationId, expectedSignal, beforeValue, afterValue);
  }

  batchCheckRegressions(
    metrics: Record<string, { before: number; after: number }>,
    threshold?: number,
  ): RegressionCheck[] {
    const checks: RegressionCheck[] = [];

    for (const [metric, values] of Object.entries(metrics)) {
      checks.push(
        this.checkRegression(metric, values.before, values.after, threshold),
      );
    }

    return checks;
  }

  batchVerifyRecommendations(
    recommendations: Array<{
      id: string;
      expectedSignal: RecommendationVerification["expectedSignal"];
      beforeValue: number;
      afterValue: number;
    }>,
  ): RecommendationVerification[] {
    return recommendations.map((rec) =>
      this.verifyRecommendation(
        rec.id,
        rec.expectedSignal,
        rec.beforeValue,
        rec.afterValue,
      ),
    );
  }
}
