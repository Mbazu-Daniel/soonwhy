import { CONFIDENCE_HIGH_MIN_SCORE, CONFIDENCE_MEDIUM_MIN_SCORE } from "./root-cause.constants";
import type { ConfidenceTier } from "./root-cause.types";

export function confidenceTier(score: number): ConfidenceTier {
  if (score >= CONFIDENCE_HIGH_MIN_SCORE) return "high";
  if (score >= CONFIDENCE_MEDIUM_MIN_SCORE) return "medium";
  return "low";
}

const LOWER_TIER: Record<ConfidenceTier, ConfidenceTier> = { high: "medium", medium: "low", low: "low" };

export function lowerTier(tier: ConfidenceTier): ConfidenceTier {
  return LOWER_TIER[tier];
}
