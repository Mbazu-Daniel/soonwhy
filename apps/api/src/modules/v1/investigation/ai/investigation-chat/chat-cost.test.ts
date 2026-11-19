import { describe, expect, it } from "vitest";
import { estimateChatCostUsd } from "./chat-cost";

const PRICING = { inputUsdPerMillion: 3, outputUsdPerMillion: 15 };

describe("estimateChatCostUsd", () => {
  it("prices input and output tokens separately", () => {
    const cost = estimateChatCostUsd({ inputTokens: 2_000_000, outputTokens: 100_000, totalTokens: 2_100_000 }, PRICING);
    expect(cost).toBeCloseTo(7.5, 10);
  });

  it("is zero for a free model", () => {
    expect(estimateChatCostUsd({ inputTokens: 500, outputTokens: 500, totalTokens: 1_000 }, { inputUsdPerMillion: 0, outputUsdPerMillion: 0 })).toBe(0);
  });

  it("gives no estimate when the model has no price", () => {
    expect(estimateChatCostUsd({ inputTokens: 500, outputTokens: 500, totalTokens: 1_000 }, null)).toBeUndefined();
  });
});
