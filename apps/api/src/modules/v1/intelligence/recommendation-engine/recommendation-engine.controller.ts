import { Controller, Post, Get, Body, Param } from "@nestjs/common";
import { RecommendationEngineService } from "./recommendation-engine.service";
import type {
  RecommendationRequest,
  RecommendationSet,
  Recommendation,
  RecommendationCategory,
  RecommendationPriority,
} from "./recommendation-engine.types";

@Controller("intelligence/recommendations")
export class RecommendationEngineController {
  constructor(private readonly recommendationService: RecommendationEngineService) {}

  @Post("generate")
  generate(@Body() request: RecommendationRequest): RecommendationSet {
    return this.recommendationService.generateRecommendations(request);
  }

  @Post("top")
  getTop(
    @Body()
    body: {
      recommendations: Recommendation[];
      limit?: number;
    },
  ): Recommendation[] {
    return this.recommendationService.getTopRecommendations(
      body.recommendations,
      body.limit,
    );
  }

  @Post("category/:category")
  getByCategory(
    @Param("category") category: RecommendationCategory,
    @Body() body: { recommendations: Recommendation[] },
  ): Recommendation[] {
    return this.recommendationService.prioritizeByCategory(body.recommendations, category);
  }

  @Post("priority/:priority")
  getByPriority(
    @Param("priority") priority: RecommendationPriority,
    @Body() body: { recommendations: Recommendation[] },
  ): Recommendation[] {
    return this.recommendationService.prioritizeByPriority(body.recommendations, priority);
  }
}
