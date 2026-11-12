import { describe, expect, it } from "vitest";
import { buildProviderConfig } from "./llm-provider.config";

const tuning = { promptVersion: "v1" };

describe("buildProviderConfig", () => {
  it("targets the resolved endpoint with the resolved key", () => {
    const config = buildProviderConfig(
      {
        providerId: "groq",
        model: "openai/gpt-oss-120b",
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: "byok-secret",
      },
      tuning,
      { inputUsdPerMillion: 0.4, outputUsdPerMillion: 0.8 },
    );

    expect(config).toEqual({
      providerId: "groq",
      model: "openai/gpt-oss-120b",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: "byok-secret",
      promptVersion: "v1",
      timeoutMs: undefined,
      maxPromptCharacters: undefined,
      maxRetries: undefined,
      inputCostPerMillionTokensUsd: 0.4,
      outputCostPerMillionTokensUsd: 0.8,
    });
  });
});
