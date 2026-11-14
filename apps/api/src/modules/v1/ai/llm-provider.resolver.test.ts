import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiProviderCredentials } from "../../../common/db/schema";
import { CredentialCipher } from "./credential-cipher";
import { LlmCatalog } from "./llm-catalog.service";
import { LlmProviderResolver } from "./llm-provider.resolver";
import { MastraRcaProvider } from "../detections/rca.provider";
import type { AiRepository } from "./ai.repository";

type CredentialRow = typeof aiProviderCredentials.$inferSelect;

const HEX_KEY = "a".repeat(64);
const HEX_KEY_B = "b".repeat(64);

function cipherWith(hexKey: string): CredentialCipher {
  return CredentialCipher.fromEnv({
    SOONWHY_PII_ENCRYPTION_KEY: hexKey,
  });
}

function credentialRow(overrides: Partial<CredentialRow> = {}): CredentialRow {
  return {
    id: "aicredential_1",
    orgId: "org_1",
    provider: "groq",
    model: "openai/gpt-oss-120b",
    baseUrl: null,
    encryptedApiKey: cipherWith(HEX_KEY).encrypt("byok-secret"),
    keyHint: "cret",
    enabled: true,
    verifiedAt: null,
    lastErrorCode: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

function buildRepository(row?: CredentialRow | null) {
  const get = vi.fn().mockResolvedValue(row ?? null);
  return { repository: { get } satisfies Pick<AiRepository, "get">, get };
}

function buildResolver(
  row: CredentialRow | null | undefined,
  cipher = cipherWith(HEX_KEY),
) {
  const { repository, get } = buildRepository(row);
  const resolver = new LlmProviderResolver(
    repository,
    cipher,
    new LlmCatalog(),
  );
  return { resolver, get };
}

describe("LlmProviderResolver", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("serves the organisation's own credential", async () => {
    const { resolver } = buildResolver(credentialRow());

    const model = await resolver.resolve("org_1");

    expect(model).toMatchObject({
      source: "byok",
      providerId: "groq",
      model: "openai/gpt-oss-120b",
      credentialId: "aicredential_1",
      apiKey: "byok-secret",
    });
  });

  it("sends a credential with no saved base URL to the provider's documented host", async () => {
    const { resolver } = buildResolver(credentialRow());

    const model = await resolver.resolve("org_1");

    expect(model.baseUrl).toBe("https://api.groq.com/openai/v1");
  });

  it("keeps the endpoint the organisation chose for itself", async () => {
    const { resolver } = buildResolver(
      credentialRow({ baseUrl: "https://llm.internal.example/v1" }),
    );

    const model = await resolver.resolve("org_1");

    expect(model.baseUrl).toBe("https://llm.internal.example/v1");
  });

  it("refuses to run a provider whose endpoint nothing documents", async () => {
    const { resolver } = buildResolver(credentialRow({ provider: "bogus" }));

    await expect(resolver.resolve("org_1")).rejects.toMatchObject({
      status: 503,
      response: { code: "AI_PROVIDER_ENDPOINT_UNKNOWN" },
    });
  });

  it("refuses to serve an organisation with no credential", async () => {
    const { resolver } = buildResolver(null);

    await expect(resolver.resolve("org_1")).rejects.toMatchObject({
      status: 503,
      response: { code: "AI_NOT_CONFIGURED" },
    });
  });

  it("ignores a credential the organisation disabled", async () => {
    const { resolver } = buildResolver(credentialRow({ enabled: false }));

    await expect(resolver.resolve("org_1")).rejects.toMatchObject({
      status: 503,
      response: { code: "AI_NOT_CONFIGURED" },
    });
  });

  it("ignores a soft-deleted credential", async () => {
    const { resolver } = buildResolver(
      credentialRow({ deletedAt: new Date() }),
    );

    await expect(resolver.resolve("org_1")).rejects.toMatchObject({
      status: 503,
      response: { code: "AI_NOT_CONFIGURED" },
    });
  });

  it("reports AI_NOT_CONFIGURED when no credential exists", async () => {
    const { resolver } = buildResolver(null);

    await expect(resolver.resolve("org_1")).rejects.toMatchObject({
      status: 503,
      response: { code: "AI_NOT_CONFIGURED" },
    });
  });

  it("maps an undecryptable stored key to AI_CREDENTIAL_UNREADABLE", async () => {
    const { resolver } = buildResolver(
      credentialRow({ encryptedApiKey: "not:a:valid-payload" }),
    );

    await expect(resolver.resolve("org_1")).rejects.toMatchObject({
      status: 503,
      response: { code: "AI_CREDENTIAL_UNREADABLE" },
    });
  });

  it("maps a credential written under a rotated encryption key to AI_CREDENTIAL_UNREADABLE", async () => {
    const { resolver } = buildResolver(
      credentialRow({
        encryptedApiKey: cipherWith(HEX_KEY_B).encrypt("byok-secret"),
      }),
    );

    await expect(resolver.resolve("org_1")).rejects.toMatchObject({
      status: 503,
      response: { code: "AI_CREDENTIAL_UNREADABLE" },
    });
  });

  it("surfaces a missing server encryption key as its own failure", async () => {
    const { resolver } = buildResolver(
      credentialRow(),
      CredentialCipher.fromEnv({}),
    );

    await expect(resolver.resolve("org_1")).rejects.toMatchObject({
      status: 503,
      response: { code: "AI_CREDENTIAL_ENCRYPTION_UNAVAILABLE" },
    });
  });

  it("serves concurrent resolutions from one credential read", async () => {
    const { resolver, get } = buildResolver(credentialRow());

    const [first, second] = await Promise.all([
      resolver.resolve("org_1"),
      resolver.resolve("org_1"),
    ]);

    expect(get).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it("sees a rotated credential after the save invalidates the cache", async () => {
    const { resolver, get } = buildResolver(
      credentialRow({
        encryptedApiKey: cipherWith(HEX_KEY).encrypt("first-secret"),
      }),
    );

    const first = await resolver.resolve("org_1");
    get.mockResolvedValue(
      credentialRow({
        encryptedApiKey: cipherWith(HEX_KEY).encrypt("second-secret"),
        updatedAt: new Date("2026-10-02T00:00:00.000Z"),
      }),
    );
    const stillCached = await resolver.resolve("org_1");
    resolver.invalidate("org_1");
    const rotated = await resolver.resolve("org_1");

    expect(first.apiKey).toBe("first-secret");
    expect(stillCached.apiKey).toBe("first-secret");
    expect(rotated.apiKey).toBe("second-secret");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("drops the cached credential when invalidated by a save or removal", async () => {
    const { resolver, get } = buildResolver(credentialRow());

    await resolver.resolve("org_1");
    resolver.invalidate("org_1");
    await resolver.resolve("org_1");

    expect(get).toHaveBeenCalledTimes(2);
  });

  it("re-reads once the cache entry expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    const { resolver, get } = buildResolver(credentialRow());

    await resolver.resolve("org_1");
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await resolver.resolve("org_1");

    expect(get).toHaveBeenCalledTimes(2);
  });

  it("re-reads after a failed resolve instead of caching the failure", async () => {
    const { resolver, get } = buildResolver(null);

    await expect(resolver.resolve("org_1")).rejects.toBeInstanceOf(Error);
    await expect(resolver.resolve("org_1")).rejects.toBeInstanceOf(Error);

    expect(get).toHaveBeenCalledTimes(2);
  });

  it("never exposes key material through describe()", async () => {
    const { resolver } = buildResolver(credentialRow());

    const summary = await resolver.describe("org_1");

    expect(summary).toEqual({
      source: "byok",
      provider: "groq",
      model: "openai/gpt-oss-120b",
    });
    expect(JSON.stringify(summary)).not.toContain("byok-secret");
  });

  it("reports no credential source when none is configured", async () => {
    const { resolver } = buildResolver(null);

    await expect(resolver.describe("org_1")).resolves.toEqual({
      source: "none",
      provider: null,
      model: null,
    });
  });

  it("hands RCA a provider plus credential metadata and no key material", async () => {
    const { resolver } = buildResolver(credentialRow());

    const handle = await resolver.resolveForRca("org_1");

    expect(handle.provider).toBeInstanceOf(MastraRcaProvider);
    expect(handle.promptVersion).toBeTruthy();
    expect(handle.credential).toEqual({
      source: "byok",
      providerId: "groq",
      model: "openai/gpt-oss-120b",
      credentialId: "aicredential_1",
    });
    expect(JSON.stringify(handle.credential)).not.toContain("byok-secret");
  });

  it("meters nothing and fails fast when no credential exists", async () => {
    const { resolver } = buildResolver(null);

    await expect(resolver.resolveForRca("org_1")).rejects.toMatchObject({
      status: 503,
    });
  });
});
