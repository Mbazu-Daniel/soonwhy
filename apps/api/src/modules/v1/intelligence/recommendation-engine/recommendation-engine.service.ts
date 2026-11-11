import { Injectable } from "@nestjs/common";
import type {
  RecommendationRequest,
  RecommendationSet,
  Recommendation,
  RecommendationPriority,
  RecommendationCategory,
} from "./recommendation-engine.types";
import { generateRecommendations } from "./recommendation-generator";

@Injectable()
export class RecommendationEngineService {
  generateRecommendations(request: RecommendationRequest): RecommendationSet {
    const recommendations = generateRecommendations(request.findings);

    return {
      recommendations,
      summary: this.summarizeRecommendations(recommendations),
      generatedAt: new Date().toISOString(),
    };
  }

  prioritizeByCategory(
    recommendations: Recommendation[],
    category: RecommendationCategory,
  ): Recommendation[] {
    return recommendations.filter((r) => r.category === category);
  }

  prioritizeByPriority(
    recommendations: Recommendation[],
    priority: RecommendationPriority,
  ): Recommendation[] {
    return recommendations.filter((r) => r.priority === priority);
  }

  getTopRecommendations(recommendations: Recommendation[], limit: number = 5): Recommendation[] {
    const priorityOrder: RecommendationPriority[] = ["critical", "high", "medium", "low"];
    const priorityScore: Record<RecommendationPriority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return [...recommendations]
      .sort((a, b) => {
        const priorityDiff = priorityScore[b.priority] - priorityScore[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.confidence - a.confidence;
      })
      .slice(0, limit);
  }

  private summarizeRecommendations(recommendations: Recommendation[]) {
    const total = recommendations.length;

    const byPriority: Record<RecommendationPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const byCategory: Record<RecommendationCategory, number> = {
      performance: 0,
      database: 0,
      dependency: 0,
      infrastructure: 0,
      ai: 0,
      error: 0,
      architecture: 0,
      security: 0,
    };

    for (const rec of recommendations) {
      byPriority[rec.priority]++;
      byCategory[rec.category]++;
    }

    return { total, byPriority, byCategory };
  }
}
