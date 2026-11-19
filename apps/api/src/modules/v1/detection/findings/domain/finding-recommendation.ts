import { RECOMMENDATION_BY_TYPE } from "./finding-recommendation.constants";

export function recommendationFor(type: string): string | null {
  return RECOMMENDATION_BY_TYPE[type as keyof typeof RECOMMENDATION_BY_TYPE] ?? null;
}
