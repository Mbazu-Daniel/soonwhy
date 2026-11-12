import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { AiService } from "./ai.service";
import { CredentialCipher } from "./credential-cipher";
import type { CatalogModel } from "./llm-catalog.service";
import type { AiRepository } from "./ai.repository";
import type { LlmCatalog } from "./llm-catalog.service";
import type { LlmProviderResolver } from "./llm-provider.resolver";
import type { BillingService } from "../billing/billing.service";

const HEX_KEY = "a".repeat(64);
const SECRET = "gsk_supersecretproviderkey";

function catalogModel(overrides: Partial<CatalogModel> = {}): CatalogModel {
  return {
    id: "openai/gpt-oss-120b",
    label: "gpt-oss-120b",
    description: null,
    contextTokens: 128_000,
    outputTokens: 32_000,
    inputCostUsdPerMillion: 0.15,
    outputCostUsdPerMillion: 0.6,
    supportsStructuredOutput: true,
    deprecated: false,
    ...overrides,
  };
}

interface HarnessInput {
  models?: CatalogModel[];
  knownProvider?: (providerId: string) => boolean;
  allowedHosts?: string[];
  endpoint?: string | null;
  stored?: Record<string, unknown> | null;
}

function build(input: HarnessInput = {}) {  const repository = {
    get: vi.fn().mockResolvedValue(input.stored ?? null),
    upsert: vi
      .fn()
      .mockImplementation(async (data: Record<string, unknown>) => ({
        id: "aicredential_1",
        ...data,
        createdAt: new Date("2026-10-01T00:00:00.000Z"),
        updatedAt: new Date("2026-10-02T00:00:00.000Z"),
      })),
    remove: vi.fn().mockResolvedValue({ id: "aicredential_1" }),
    recordVerification: vi.fn().mockResolvedValue(undefined),
    getInvocationTotals: vi.fn().mockResolvedValue([]),
  } satisfies Pick<
    AiRepository,
    "get" | "upsert" | "remove" | "recordVerification" | "getInvocationTotals"
  >;

  const resolver = {
    resolve: vi.fn().mockResolvedValue({
      source: "byok" as const,
      providerId: "groq",
      model: "openai/gpt-oss-120b",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: SECRET,
      credentialId: "aicredential_1",
    }),
    describe: vi.fn().mockResolvedValue({
      source: "byok" as const,
      provider: "groq",
      model: "openai/gpt-oss-120b",
    }),
    invalidate: vi.fn(),
  } satisfies Pick<LlmProviderResolver, "resolve" | "describe" | "invalidate">;

  const catalog = {
    providers: vi.fn().mockReturnValue([]),
    models: vi.fn().mockResolvedValue(input.models ?? [catalogModel()]),
    isKnownProvider: vi
      .fn()
      .mockImplementation(
        input.knownProvider ?? ((id: string) => id === "groq"),
      ),
    allowedHostnamesFor: vi
      .fn()
      .mockReturnValue(input.allowedHosts ?? ["api.groq.com"]),
    endpointFor: vi
      .fn()
      .mockReturnValue(
        input.endpoint === undefined
          ? "https://api.groq.com/openai/v1"
          : input.endpoint,
      ),
  } satisfies Pick<
    LlmCatalog,
    | "providers"
    | "models"
    | "isKnownProvider"
    | "allowedHostnamesFor"
    | "endpointFor"
  >;

  const billing = {
    getUsage: vi.fn().mockResolvedValue([]),
    getLimit: vi.fn().mockResolvedValue(null),
  } satisfies Pick<BillingService, "getUsage" | "getLimit">;

  const service = new AiService(
    repository,
    CredentialCipher.fromEnv({ SOONWHY_PII_ENCRYPTION_KEY: HEX_KEY }),
    resolver,
    catalog,
    billing,
  );
  return { service, repository, resolver, catalog, billing };
}

describe("AiService", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("stores ciphertext and returns no key material", async () => {
    const h = build();

    const result = await h.service.save("org_1", {
      provider: "Groq",
      model: "openai/gpt-oss-120b",
      apiKey: SECRET,
      baseUrl: null,
    });

    const stored = h.repository.upsert.mock.calls[0]?.[0];
    expect(stored?.provider).toBe("groq");
    expect(stored?.encryptedApiKey).not.toContain(SECRET);
    expect(stored?.keyHint).toBe("••••" + SECRET.slice(-4));
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(result).not.toHaveProperty("apiKey");
    expect(h.resolver.invalidate).toHaveBeenCalledWith("org_1");
  });

  it("keeps the stored key when no new key is sent", async () => {
    const h = build({
      stored: {
        provider: "groq",
        model: "openai/gpt-oss-120b",
        encryptedApiKey: "stored-ciphertext",
        keyHint: "••••1234",
      },
    });

    const result = await h.service.save("org_1", {
      provider: "groq",
      model: "openai/gpt-oss-120b",
      apiKey: "",
    });

    expect(h.repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        encryptedApiKey: "stored-ciphertext",
        keyHint: "••••1234",
      }),
    );
    expect(result).toMatchObject({ configured: true });
  });

  it("keeps the stored base URL when it is not sent again", async () => {
    const h = build({
      stored: {
        provider: "groq",
        model: "openai/gpt-oss-120b",
        baseUrl: "https://llm.internal.example/v1",
        encryptedApiKey: "stored-ciphertext",
        keyHint: "••••1234",
      },
    });

    await h.service.save("org_1", {
      provider: "groq",
      model: "openai/gpt-oss-120b",
      apiKey: "",
    });

    expect(h.repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://llm.internal.example/v1",
      }),
    );
  });

  it("requires a key when none is stored", async () => {
    const h = build({ stored: null });

    await expect(
      h.service.save("org_1", {
        provider: "groq",
        model: "openai/gpt-oss-120b",
        apiKey: "",
      }),
    ).rejects.toThrow(BadRequestException);
    expect(h.repository.upsert).not.toHaveBeenCalled();
  });

  it("round-trips the stored key through the cipher", async () => {
    const cipher = CredentialCipher.fromEnv({
      SOONWHY_PII_ENCRYPTION_KEY: HEX_KEY,
    });
    const h = build();

    await h.service.save("org_1", {
      provider: "groq",
      model: "openai/gpt-oss-120b",
      apiKey: SECRET,
    });

    const stored = h.repository.upsert.mock.calls[0]?.[0];
    expect(cipher.decrypt(String(stored?.encryptedApiKey))).toBe(SECRET);
  });

  it("rejects a provider this server cannot reach", async () => {
    const h = build();

    await expect(
      h.service.save("org_1", {
        provider: "not-a-provider",
        model: "anything",
        apiKey: SECRET,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(h.repository.upsert).not.toHaveBeenCalled();
  });

  it("rejects a base URL that belongs to a different provider", async () => {
    const h = build();

    await expect(
      h.service.save("org_1", {
        provider: "groq",
        model: "openai/gpt-oss-120b",
        apiKey: SECRET,
        baseUrl: "https://api.openai.com/v1",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "AI_PROVIDER_BASE_URL_INVALID",
      }),
    });
    expect(h.repository.upsert).not.toHaveBeenCalled();
  });

  it("refuses to send a key to a metadata address", async () => {
    const h = build({ allowedHosts: [] });

    await expect(
      h.service.save("org_1", {
        provider: "groq",
        model: "openai/gpt-oss-120b",
        apiKey: SECRET,
        baseUrl: "https://169.254.169.254/latest/meta-data",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "AI_PROVIDER_BASE_URL_INVALID",
      }),
    });
  });

  it("accepts a gateway host the operator allowlisted", async () => {
    vi.stubEnv("SOONWHY_AI_ALLOWED_BASE_HOSTS", "llm.internal.example");
    const h = build({ allowedHosts: [] });

    await expect(
      h.service.save("org_1", {
        provider: "groq",
        model: "openai/gpt-oss-120b",
        apiKey: SECRET,
        baseUrl: "https://llm.internal.example/v1",
      }),
    ).resolves.toMatchObject({ configured: true });
  });

  it("warns instead of blocking a model that cannot do structured output", async () => {
    const h = build({
      models: [catalogModel({ supportsStructuredOutput: false })],
    });

    const result = await h.service.save("org_1", {
      provider: "groq",
      model: "openai/gpt-oss-120b",
      apiKey: SECRET,
    });

    expect(result.warnings).toEqual([
      expect.stringContaining("structured output"),
    ]);
  });

  it("removes the credential without destroying it", async () => {
    const h = build();

    await expect(h.service.remove("org_1")).resolves.toEqual({
      configured: false,
    });
    expect(h.repository.remove).toHaveBeenCalledWith("org_1");
    expect(h.resolver.invalidate).toHaveBeenCalledWith("org_1");
  });

  it("never reports a platform credential when none is configured", async () => {
    vi.stubEnv("SOONWHY_AI_QUOTA_ENFORCED", "false");
    const h = build({ stored: null });
    h.resolver.describe.mockResolvedValue({
      source: "none",
      provider: null,
      model: null,
    });

    const config = await h.service.get("org_1", true);
    const providers = await h.service.providers("org_1", false);

    expect(config).toEqual({
      configured: false,
      canManage: true,
      activeSource: "none",
    });
    expect(providers.canManage).toBe(false);
    expect(providers.quotaEnforced).toBe(false);
    expect(JSON.stringify(providers)).not.toContain(SECRET);
  });

  it("classifies a rejected key without forwarding the provider response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: `key=${SECRET}` } }), {
        status: 401,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const h = build();

    const result = await h.service.testConnection("org_1");

    expect(result).toMatchObject({
      ok: false,
      checkable: true,
      code: "invalid_key",
    });
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(h.repository.recordVerification).toHaveBeenCalledWith("org_1", {
      verified: false,
      errorCode: "invalid_key",
    });
  });

  it("treats a rate limit as proof the key works", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 429 })),
    );
    const h = build();

    const result = await h.service.testConnection("org_1");

    expect(result.ok).toBe(true);
    expect(result.code).toBe("rate_limited");
    expect(h.repository.recordVerification).toHaveBeenCalledWith("org_1", {
      verified: false,
      errorCode: "rate_limited",
    });
  });

  it("records verification only for the stored credential", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const h = build();

    const result = await h.service.testConnection("org_1", {
      provider: "groq",
      model: "openai/gpt-oss-120b",
      apiKey: "draft-key-not-stored",
    });

    expect(result.code).toBe("verified");
    expect(h.repository.recordVerification).not.toHaveBeenCalled();
    expect(h.resolver.resolve).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { authorization: "Bearer draft-key-not-stored" },
    });
  });

  it("reports an unreachable endpoint when the network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error(`connect ECONNREFUSED ${SECRET}`)),
    );
    const h = build();

    const result = await h.service.testConnection("org_1");

    expect(result).toMatchObject({ ok: false, code: "unreachable" });
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it("says so when a provider has no queryable endpoint", async () => {
    const h = build({ endpoint: null });

    const result = await h.service.testConnection("org_1");

    expect(result).toMatchObject({
      ok: false,
      checkable: false,
      code: "no_http_endpoint",
    });
  });

  it("splits monthly spend by who paid for the tokens", async () => {
    const h = build();
    h.billing.getUsage.mockResolvedValue([
      { metric: "ai_tokens", quantity: 4_000 },
      { metric: "ai_tokens_byok", quantity: 90_000 },
      { metric: "rca_invocations", quantity: 12 },
    ]);
    h.billing.getLimit.mockResolvedValue(200_000);
    h.repository.getInvocationTotals.mockResolvedValue([
      {
        credentialSource: "byok",
        status: "success",
        runs: 10,
        tokens: 90_000,
        costUsd: 1.42,
      },
      {
        credentialSource: "platform",
        status: "success",
        runs: 2,
        tokens: 4_000,
        costUsd: 0.08,
      },
      {
        credentialSource: null,
        status: "failed",
        runs: 1,
        tokens: 0,
        costUsd: 0,
      },
    ]);

    const usage = await h.service.usage("org_1");

    expect(usage.tokens).toEqual({ platform: 4_000, byok: 90_000 });
    expect(usage.invocations).toBe(12);
    expect(usage.costUsd).toEqual({ platform: 0.08, byok: 1.42 });
    expect(usage.limits).toEqual({
      aiTokens: 200_000,
      rcaInvocations: 200_000,
    });
    expect(usage.runs).toEqual([
      {
        credentialSource: "byok",
        status: "success",
        runs: 10,
        tokens: 90_000,
        costUsd: 1.42,
      },
      {
        credentialSource: "platform",
        status: "success",
        runs: 2,
        tokens: 4_000,
        costUsd: 0.08,
      },
      {
        credentialSource: null,
        status: "failed",
        runs: 1,
        tokens: 0,
        costUsd: 0,
      },
    ]);
  });
});
