import type { ModelPricing } from "../llm-catalog.service";
import type { ChatUsage } from "./investigation-chat.types";

export function estimateChatCostUsd(usage: ChatUsage, pricing: ModelPricing | null): number | undefined {
  if (!pricing) return undefined;
  return (
    (usage.inputTokens / 1_000_000) * pricing.inputUsdPerMillion +
    (usage.outputTokens / 1_000_000) * pricing.outputUsdPerMillion
  );
}
