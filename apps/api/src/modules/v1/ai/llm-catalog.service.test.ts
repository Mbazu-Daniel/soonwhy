import { beforeEach, describe, expect, it, vi } from "vitest";
import { LlmCatalog } from "./llm-catalog.service";

const MODELS_DEV_DOC = {
  groq: {
    name: "Groq",
    api: "https://api.groq.com/openai/v1",
    models: {
      "openai/gpt-oss-120b": {
        name: "gpt-oss-120b",
        description: "Open-weight reasoning model",
        structured_output: true,
        status: "active",
        limit: { context: 128_000, output: 32_000 },
        cost: { input: 0.15, output: 0.6 },
      },
      "llama-3.1-8b-instant": {
        name: "Llama 3.1 8B Instant",
        structured_output: false,
        limit: { context: 128_000 },
        cost: { input: 0.05 },
      },
    },
  },
  "unknown-to-mastra": {
    name: "Not resolvable through Mastra",
    models: { "some-model": { name: "Some Model" } },
  },
};

function respondWith(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("LlmCatalog", () => {
  let catalog: LlmCatalog;

  beforeEach(() => {
    catalog = new LlmCatalog();
    vi.restoreAllMocks();
  });

  it("lists only providers Mastra can resolve, labelled and sorted", () => {
    const providers = catalog.providers();
    const ids = providers.map((provider) => provider.id);
    const labels = providers.map((provider) => provider.label);

    expect(ids).toContain("groq");
    expect(ids).toContain("openai");
    expect(ids).not.toContain("unknown-to-mastra");
    expect(
      providers.find((provider) => provider.id === "groq")?.modelCount,
    ).toBeGreaterThan(0);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    expect(providers.find((provider) => provider.id === "groq")?.baseUrl).toBe(
      "https://api.groq.com/openai/v1",
    );
  });

  it("recognises registry membership", () => {
    expect(catalog.isKnownProvider("groq")).toBe(true);
    expect(catalog.isKnownProvider("bogus")).toBe(false);
  });

  it("returns the registry host only when Mastra documents one", () => {
    expect(catalog.baseUrlFor("groq")).toBe("https://api.groq.com/openai/v1");
    expect(catalog.baseUrlFor("bogus")).toBeNull();
  });

  it("allows only documented hostnames for a provider key", () => {
    expect(catalog.allowedHostnamesFor("groq")).toContain("api.groq.com");
    expect(catalog.allowedHostnamesFor("bogus")).toEqual([]);
  });

  it("reports structured-output capability without any network access", () => {
    expect(catalog.supportsStructuredOutput("openai", "gpt-4o")).toBe(true);
    expect(catalog.supportsStructuredOutput("groq", "no-such-model")).toBe(
      false,
    );
  });

  it("has no pricing before the enrichment fetch has run", () => {
    expect(catalog.pricing("groq", "openai/gpt-oss-120b")).toBeNull();
    expect(catalog.provider("groq")?.rcaSafeModelCount).toBeNull();
  });

  it("enriches registry models with models.dev metadata", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(respondWith(MODELS_DEV_DOC));

    const models = await catalog.models("groq");
    const versatile = models.find(
      (model) => model.id === "openai/gpt-oss-120b",
    );

    expect(versatile).toMatchObject({
      label: "gpt-oss-120b",
      description: "Open-weight reasoning model",
      contextTokens: 128_000,
      outputTokens: 32_000,
      inputCostUsdPerMillion: 0.15,
      outputCostUsdPerMillion: 0.6,
      supportsStructuredOutput: true,
      deprecated: false,
    });
    expect(
      models.find((model) => model.id === "llama-3.1-8b-instant")?.deprecated,
    ).toBe(true);
    expect(catalog.pricing("groq", "openai/gpt-oss-120b")).toEqual({
      inputUsdPerMillion: 0.15,
      outputUsdPerMillion: 0.6,
    });
    // Pricing needs both rates before it can attribute a cost.
    expect(catalog.pricing("groq", "llama-3.1-8b-instant")).toBeNull();
    expect(catalog.provider("groq")?.rcaSafeModelCount).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts the nulls models.dev sends for fields it has not filled in", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      respondWith({
        groq: {
          id: "groq",
          env: "GROQ_API_KEY",
          npm: "@ai-sdk/groq",
          name: "Groq",
          doc: "https://console.groq.com/docs/models",
          api: null,
          models: {
            "llama-3.3-70b-versatile": {
              name: "Llama 3.3 70B",
              description: null,
              structured_output: null,
              status: "deprecated",
              limit: { context: 131_072, output: 32_768 },
              cost: { input: 0.59, output: 0.79 },
            },
          },
        },
      }),
    );

    const models = await catalog.models("groq");

    expect(
      models.find((model) => model.id === "llama-3.3-70b-versatile"),
    ).toMatchObject({
      label: "Llama 3.3 70B",
      contextTokens: 131_072,
      inputCostUsdPerMillion: 0.59,
      deprecated: true,
    });
    expect(catalog.provider("groq")?.rcaSafeModelCount).not.toBeNull();
  });

  it("keeps enriching when one provider or model entry is malformed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      respondWith({
        groq: {
          name: "Groq",
          models: {
            "openai/gpt-oss-120b": { name: "gpt-oss-120b" },
            "broken-entry": "not an object",
          },
        },
        neon: { name: "Neon", api: "postgres://not-a-url", models: null },
      }),
    );

    const models = await catalog.models("groq");

    expect(models.map((model) => model.id)).toContain("openai/gpt-oss-120b");
    expect(
      models.find((model) => model.id === "openai/gpt-oss-120b")?.label,
    ).toBe("gpt-oss-120b");
  });

  it("falls back to registry ids with no metadata when models.dev is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("dns failure"));

    const models = await catalog.models("groq");
    const first = models.find((model) => model.id === "groq/compound");

    expect(models.length).toBeGreaterThan(0);
    expect(first?.label).toBe(first?.id);
    expect(first?.contextTokens).toBeNull();
    expect(first?.inputCostUsdPerMillion).toBeNull();
    expect(catalog.providers().length).toBeGreaterThan(0);
  });

  it("caches enrichment and does not retry a failed fetch immediately", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(respondWith(MODELS_DEV_DOC));

    await catalog.models("groq");
    await catalog.models("groq");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps registry models when models.dev documents a provider Mastra cannot resolve", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      respondWith(MODELS_DEV_DOC),
    );

    expect(await catalog.models("unknown-to-mastra")).toEqual([]);
    expect(catalog.isKnownProvider("unknown-to-mastra")).toBe(false);
  });

  it("returns an empty model list for an unknown provider without fetching", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    return expect(catalog.models("bogus"))
      .resolves.toEqual([])
      .then(() => {
        expect(fetchMock).not.toHaveBeenCalled();
      });
  });
});
