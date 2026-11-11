import { describe, expect, it } from "vitest";
import {
  buildProviderConfig,
  readPlatformLlmConfig,
} from "./llm-provider.config";

const tuning = { promptVersion: "v1" };

describe("readPlatformLlmConfig", () => {
  it("is off until both a key and a model exist", () => {
    expect(
      readPlatformLlmConfig({ SOONWHY_RCA_MODEL: "openai/gpt-4o" }).configured,
    ).toBe(false);
    expect(
      readPlatformLlmConfig({
        SOONWHY_RCA_MODEL: "openai/gpt-4o",
        SOONWHY_RCA_API_KEY: "platform-secret",
      }).configured,
    ).toBe(true);
  });

  it("treats a blank variable as unset", () => {
    const config = readPlatformLlmConfig({
      SOONWHY_RCA_API_KEY: "  ",
      SOONWHY_RCA_MODEL: "  ",
      SOONWHY_RCA_BASE_URL: "  ",
    });

    expect(config).toEqual({
      configured: false,
      providerId: "openai",
      model: "",
      baseUrl: null,
      apiKey: "",
    });
  });
});

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
