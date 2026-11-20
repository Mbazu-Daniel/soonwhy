import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { AiService } from "./ai.service";
import { CredentialCipher } from "../domain/credential-cipher";
import type { CatalogModel } from "../domain/llm-catalog.service.types";
import type { AiRepository } from "../infrastructure/ai.repository";
import type { LlmCatalog } from "./llm-catalog.service";
import type { LlmProviderResolver } from "./llm-provider.resolver";
import type { BillingService } from "../../../platform/billing/application/billing.service";

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

function build(input: HarnessInput = {}) {
  const stamp = new Date("2026-10-01T00:00:00.000Z");
  const row = input.stored
    ? {
        id: "aicredential_1",
        orgId: "org_1",
        name: "Groq",
        isDefault: true,
        enabled: true,
        baseUrl: null,
        verifiedAt: null,
        lastErrorCode: null,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
        ...input.stored,
      }
    : null;
  const repository = {
    get: vi.fn().mockResolvedValue(row),
    list: vi.fn().mockResolvedValue(row ? [row] : []),
    find: vi
      .fn()
      .mockImplementation(async (_org: string, id: string) => (row && row.id === id ? row : null)),
    create: vi
      .fn()
      .mockImplementation(async (data: Record<string, unknown>, makeDefault: boolean) => ({
        id: "aicredential_2",
        ...data,
        isDefault: makeDefault || !row,
        enabled: true,
        verifiedAt: null,
        lastErrorCode: null,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      })),
    update: vi
      .fn()
      .mockImplementation(
        async (_org: string, id: string, patch: Record<string, unknown>, makeDefault: boolean) =>
          row && row.id === id ? { ...row, ...patch, isDefault: makeDefault || row.isDefault } : null,
      ),
    remove: vi.fn().mockResolvedValue({ id: "aicredential_1" }),
    recordVerification: vi.fn().mockResolvedValue(undefined),
    getInvocationTotals: vi.fn().mockResolvedValue([]),
    getProjectSpend: vi.fn().mockResolvedValue([]),
    getChatCostTotals: vi.fn().mockResolvedValue([]),
  } as unknown as Pick<
    AiRepository,
    | "get"
    | "list"
    | "find"
    | "create"
    | "update"
    | "remove"
    | "recordVerification"
    | "getInvocationTotals"
    | "getProjectSpend"
    | "getChatCostTotals"
  > & {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    recordVerification: ReturnType<typeof vi.fn>;
    getInvocationTotals: ReturnType<typeof vi.fn>;
    getProjectSpend: ReturnType<typeof vi.fn>;
    getChatCostTotals: ReturnType<typeof vi.fn>;
  };

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

    const stored = h.repository.create.mock.calls[0]?.[0];
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

    const patch = h.repository.update.mock.calls[0]?.[2];
    expect(patch).not.toHaveProperty("encryptedApiKey");
    expect(patch).not.toHaveProperty("keyHint");
    expect(result).toMatchObject({ configured: true, keyHint: "••••1234" });
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

    expect(h.repository.update.mock.calls[0]?.[2]).not.toHaveProperty("baseUrl");
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
    expect(h.repository.create).not.toHaveBeenCalled();
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

    const stored = h.repository.create.mock.calls[0]?.[0];
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
    expect(h.repository.create).not.toHaveBeenCalled();
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
    expect(h.repository.create).not.toHaveBeenCalled();
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
    const h = build({ stored: { provider: "groq", model: "m", encryptedApiKey: "c", keyHint: "k" } });

    await expect(h.service.remove("org_1")).resolves.toEqual({
      configured: false,
    });
    expect(h.repository.remove).toHaveBeenCalledWith("org_1", "aicredential_1");
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
    expect(h.repository.recordVerification).toHaveBeenCalledWith("org_1", "aicredential_1", {
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
    expect(h.repository.recordVerification).toHaveBeenCalledWith("org_1", "aicredential_1", {
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

  it("returns each project's spend alongside the organization totals", async () => {
    const h = build();
    const projects = [
      { projectId: "p1", name: "Web", slug: "web", runs: 3, rcaTokens: 9_000, chatTokens: 1_000, chatCostUsd: 0.1, costUsd: 0.4 },
      { projectId: "p2", name: "Worker", slug: "worker", runs: 0, rcaTokens: 0, chatTokens: 500, chatCostUsd: 0, costUsd: 0 },
    ];
    h.repository.getProjectSpend.mockResolvedValue(projects);

    const usage = await h.service.usage("org_1");

    expect(usage.projects).toEqual(projects);
    expect(h.repository.getProjectSpend).toHaveBeenCalledWith("org_1", expect.any(Date), expect.any(Date));
  });

  it("adds chat cost to the organization totals, split by who paid", async () => {
    const h = build();
    h.repository.getInvocationTotals.mockResolvedValue([
      { credentialSource: "byok", status: "success", runs: 1, tokens: 1_000, costUsd: 1 },
      { credentialSource: "platform", status: "success", runs: 1, tokens: 1_000, costUsd: 0.5 },
    ]);
    h.repository.getChatCostTotals.mockResolvedValue([
      { credentialSource: "byok", costUsd: 0.25 },
      { credentialSource: null, costUsd: 0 },
    ]);

    const usage = await h.service.usage("org_1");

    expect(usage.costUsd).toEqual({ platform: 0.5, byok: 1.25 });
  });

  it("reads the previous month when asked for it", async () => {
    const h = build();

    const usage = await h.service.usage("org_1", "last_month", new Date("2026-11-18T13:30:00Z"));

    expect(usage.period).toEqual({
      name: "last_month",
      start: new Date("2026-10-01T00:00:00Z"),
      end: new Date("2026-11-01T00:00:00Z"),
    });
    expect(h.repository.getProjectSpend).toHaveBeenCalledWith("org_1", usage.period.start, usage.period.end);
    expect(h.repository.getInvocationTotals).toHaveBeenCalledWith("org_1", usage.period.start, usage.period.end);
  });

  describe("provider library", () => {
    const stored = { provider: "groq", model: "openai/gpt-oss-120b", encryptedApiKey: "cipher", keyHint: "••••1234" };

    it("names a new provider after its catalog entry when no name is given", async () => {
      const h = build();

      const created = await h.service.create("org_1", { provider: "groq", model: "m", apiKey: SECRET });

      expect(h.repository.create.mock.calls[0]?.[0]).toMatchObject({ name: "groq", orgId: "org_1" });
      expect(created.name).toBe("groq");
      expect(JSON.stringify(created)).not.toContain(SECRET);
    });

    it("passes the default flag through so the repository can move it", async () => {
      const h = build({ stored });

      await h.service.create("org_1", { name: "Fast lane", provider: "groq", model: "m", apiKey: SECRET, isDefault: true });

      expect(h.repository.create.mock.calls[0]?.[1]).toBe(true);
      expect(h.resolver.invalidate).toHaveBeenCalledWith("org_1");
    });

    it("answers a duplicate name with a conflict", async () => {
      const h = build({ stored });
      h.repository.create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "23505" }));

      await expect(
        h.service.create("org_1", { name: "Groq", provider: "groq", model: "m", apiKey: SECRET }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("recognises a duplicate name wrapped inside a driver error", async () => {
      const h = build({ stored });
      h.repository.update.mockRejectedValueOnce(
        Object.assign(new Error("query failed"), { cause: { code: "23505" } }),
      );

      await expect(h.service.update("org_1", "aicredential_1", { name: "Taken" })).rejects.toMatchObject({
        status: 409,
      });
    });

    it("switches the model without touching the key", async () => {
      const h = build({ stored });

      const updated = await h.service.update("org_1", "aicredential_1", { model: "openai/gpt-oss-20b" });

      expect(h.repository.update.mock.calls[0]?.[2]).toEqual({ model: "openai/gpt-oss-20b" });
      expect(updated.model).toBe("openai/gpt-oss-20b");
      expect(updated.keyHint).toBe("••••1234");
    });

    it("makes a provider the default on request", async () => {
      const h = build({ stored });

      await h.service.update("org_1", "aicredential_1", { isDefault: true });

      expect(h.repository.update.mock.calls[0]?.[3]).toBe(true);
    });

    it("answers 404 for a provider that is not in the organisation", async () => {
      const h = build({ stored });

      await expect(h.service.update("org_1", "elsewhere", { model: "m" })).rejects.toMatchObject({ status: 404 });
      h.repository.remove.mockResolvedValueOnce(null);
      await expect(h.service.removeCredential("org_1", "elsewhere")).rejects.toMatchObject({ status: 404 });
    });

    it("lists providers without any key material", async () => {
      const h = build({ stored });

      const listed = await h.service.list("org_1", true);

      expect(listed.credentials).toHaveLength(1);
      expect(listed.credentials[0]).toMatchObject({ id: "aicredential_1", isDefault: true, keyHint: "••••1234" });
      expect(JSON.stringify(listed)).not.toContain("cipher");
    });

    it("needs a base URL for a custom endpoint", async () => {
      const h = build({ knownProvider: (id) => id === "custom" });

      await expect(
        h.service.create("org_1", { provider: "custom", model: "local-model", apiKey: "k" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("accepts any public https host for a custom endpoint, even with an allowlist", async () => {
      vi.stubEnv("SOONWHY_AI_ALLOWED_BASE_HOSTS", "only.this.host");
      const h = build({ knownProvider: (id) => id === "custom", allowedHosts: [] });

      const created = await h.service.create("org_1", {
        provider: "custom",
        model: "local-model",
        apiKey: "k",
        baseUrl: "https://llm.example.com/v1",
      });

      expect(created.baseUrl).toBe("https://llm.example.com/v1");
    });

    it("still refuses a custom endpoint on a metadata address", async () => {
      const h = build({ knownProvider: (id) => id === "custom" });

      await expect(
        h.service.create("org_1", { provider: "custom", model: "m", apiKey: "k", baseUrl: "https://169.254.169.254/v1" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("lists the models a key can actually use, sorted", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "b-model" }, { id: "a-model" }, { id: "a-model" }] }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      const h = build();

      const listed = await h.service.liveModels("org_1", { provider: "groq", apiKey: "typed-key" });

      expect(listed).toEqual({ source: "live", models: ["a-model", "b-model"] });
      expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.groq.com/openai/v1/models");
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: { authorization: "Bearer typed-key" } });
    });

    it("uses the stored key when listing models for a saved provider", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "m1" }] }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      const h = build({ stored });

      await h.service.liveModels("org_1", { credentialId: "aicredential_1" });

      expect(h.resolver.resolve).toHaveBeenCalledWith("org_1", "aicredential_1");
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: { authorization: `Bearer ${SECRET}` } });
    });

    it("says the key was rejected, without echoing the provider response", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret provider text", { status: 401 })));
      const h = build();

      const failure = await h.service.liveModels("org_1", { provider: "groq", apiKey: "bad" }).catch((e) => e);

      expect(failure).toBeInstanceOf(BadRequestException);
      expect(JSON.stringify(failure.getResponse())).toContain("rejected");
      expect(JSON.stringify(failure.getResponse())).not.toContain("secret provider text");
    });

    it("says the endpoint cannot be reached", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
      const h = build();

      const failure = await h.service.liveModels("org_1", { provider: "groq", apiKey: "k" }).catch((e) => e);

      expect(JSON.stringify(failure.getResponse())).toContain("Could not reach");
    });

    it("falls back to the catalog when a provider has no queryable endpoint", async () => {
      const h = build({ endpoint: null });

      const listed = await h.service.liveModels("org_1", { provider: "groq", apiKey: "k" });

      expect(listed.source).toBe("catalog");
      expect(listed.models).toEqual(["openai/gpt-oss-120b"]);
    });

    it("needs a provider and a key, or a saved provider, to list models", async () => {
      const h = build();

      await expect(h.service.liveModels("org_1", { provider: "groq" })).rejects.toThrow(BadRequestException);
    });
  });
});
