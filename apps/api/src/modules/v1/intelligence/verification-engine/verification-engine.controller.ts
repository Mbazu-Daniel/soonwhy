import { Controller, Post, Body } from "@nestjs/common";
import { VerificationEngineService } from "./verification-engine.service";
import type {
  VerificationRequest,
  VerificationResult,
  RegressionCheck,
  RecommendationVerification,
} from "./verification-engine.types";

@Controller("intelligence/verification")
export class VerificationEngineController {
  constructor(private readonly verificationService: VerificationEngineService) {}

  @Post("verify-change")
  verifyChange(@Body() request: VerificationRequest): VerificationResult {
    return this.verificationService.verifyChange(request);
  }

  @Post("check-regression")
  checkRegression(
    @Body()
    body: {
      metric: string;
      beforeBaseline: number;
      currentValue: number;
      threshold?: number;
    },
  ): RegressionCheck {
    return this.verificationService.checkRegression(
      body.metric,
      body.beforeBaseline,
      body.currentValue,
      body.threshold,
    );
  }

  @Post("batch-regressions")
  batchCheckRegressions(
    @Body()
    body: {
      metrics: Record<string, { before: number; after: number }>;
      threshold?: number;
    },
  ): RegressionCheck[] {
    return this.verificationService.batchCheckRegressions(body.metrics, body.threshold);
  }

  @Post("verify-recommendation")
  verifyRecommendation(
    @Body()
    body: {
      recommendationId: string;
      expectedSignal: RecommendationVerification["expectedSignal"];
      beforeValue: number;
      afterValue: number;
    },
  ): RecommendationVerification {
    return this.verificationService.verifyRecommendation(
      body.recommendationId,
      body.expectedSignal,
      body.beforeValue,
      body.afterValue,
    );
  }

  @Post("batch-recommendations")
  batchVerifyRecommendations(
    @Body()
    body: {
      recommendations: Array<{
        id: string;
        expectedSignal: RecommendationVerification["expectedSignal"];
        beforeValue: number;
        afterValue: number;
      }>;
    },
  ): RecommendationVerification[] {
    return this.verificationService.batchVerifyRecommendations(body.recommendations);
  }
}
