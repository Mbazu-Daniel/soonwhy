import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpException } from "@nestjs/common";
import { RcaApiService } from "./rca.api";
import { QuotaExceededError } from "../billing/billing.errors";
import type { RcaCredentialInfo } from "./rca.types";
import type { LlmCredentialSummary } from "../ai/llm-provider.resolver";

function credential(
  overrides: Partial<RcaCredentialInfo> = {},
): RcaCredentialInfo {
  return {
    source: "byok",
    providerId: "groq",
    model: "openai/gpt-oss-120b",
    credentialId: "aicredential_1",
    ...overrides,
  };
}

function billingStub() {
  return {
    assertQuota: vi.fn().mockResolvedValue(undefined),
    recordUsage: vi.fn().mockResolvedValue({ id: "usage_1" }),
  };
}

function analysis() {
  return {
    summary: "Latency increased.",
    rootCause: "Slow database dependency.",
    contributingFactors: [],
    investigationSteps: ["Inspect the query plan."],
    suggestedChanges: ["Review indexes."],
    evidenceRefs: ["latency_1:0"],
    confidence: "high" as const,
    limitations: [],
  };
}

function finding(overrides: Record<string, unknown> = {}) {
  return {
    id: "finding_1",
    orgId: "org_1",
    projectId: "project_1",
    serviceName: "checkout-api",
    type: "bottleneck",
    severity: "critical",
    title: "Correlated bottleneck",
    description: "Latency correlates with a dependency.",
    observedValue: 1600,
    threshold: 1000,
    unit: "ms",
    windowStart: new Date("2026-09-22T10:00:00Z"),
    windowEnd: new Date("2026-09-22T10:15:00Z"),
    evidence: [
      {
        kind: "metric",
        label: "correlated-signal",
        value: 1600,
        context: { sourceFindingId: "latency_1" },
      },
      {
        kind: "metric",
        label: "supporting-finding",
        value: 900,
        context: {
          findingId: "dependency_1",
          findingType: "dependency_latency",
          severity: "critical",
          service: "checkout-api",
        },
      },
      {
        kind: "trace",
        label: "correlated-trace",
        value: "trace_1",
        context: { traceId: "trace_1" },
      },
      {
        kind: "recommendation",
        label: "optimization-guidance",
        value: "Inspect the database query plan.",
        context: { dependencyType: "database", dependencyName: "postgres" },
      },
    ],
    ...overrides,
  };
}

interface GenerateHarness {
  usage?: Record<string, unknown>;
  credential?: RcaCredentialInfo;
  summary?: LlmCredentialSummary;
}

function harness(input: GenerateHarness = {}) {
  const cred = input.credential ?? credential();
  const repository = { findFinding: vi.fn().mockResolvedValue(finding()) };
  const persistence = {
    findLatest: vi.fn().mockResolvedValue(null),
    list: vi.fn(),
    persist: vi.fn().mockResolvedValue({ id: "rca_2" }),
  };
  const orchestrator = {
    describe: vi.fn().mockResolvedValue(
      input.summary ?? {
        source: cred.source,
        provider: cred.providerId,
        model: cred.model,
      },
    ),
    analyze: vi.fn().mockResolvedValue({
      analysis: analysis(),
      usage: { requestDurationMs: 12, retries: 0, ...input.usage },
      promptVersion: "v2",
      credential: cred,
    }),
  };
  const governance = {
    recordSuccess: vi.fn().mockResolvedValue(undefined),
    recordFailure: vi.fn().mockResolvedValue(undefined),
  };
  const billing = billingStub();
  const service = new RcaApiService(
    repository,
    orchestrator,
    persistence,
    governance,
    billing,
  );
  return {
    service,
    repository,
    persistence,
    orchestrator,
    governance,
    billing,
  };
}

describe("RcaApiService", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns an existing analysis without calling the provider", async () => {
    const existing = { id: "rca_1" };
    const repository = { findFinding: vi.fn().mockResolvedValue(finding()) };
    const persistence = {
      findLatest: vi.fn().mockResolvedValue(existing),
      list: vi.fn(),
      persist: vi.fn(),
    };
    const orchestrator = { analyze: vi.fn(), describe: vi.fn() };
    const governance = { recordSuccess: vi.fn(), recordFailure: vi.fn() };
    const service = new RcaApiService(
      repository,
      orchestrator,
      persistence,
      governance,
      billingStub(),
    );

    await expect(
      service.generate("org_1", "project_1", "finding_1", false),
    ).resolves.toEqual(existing);
    expect(orchestrator.analyze).not.toHaveBeenCalled();
    expect(governance.recordSuccess).not.toHaveBeenCalled();
  });

  it("generates and persists an RCA when regeneration is requested", async () => {
    const persisted = { id: "rca_2", ...analysis() };
    const repository = { findFinding: vi.fn().mockResolvedValue(finding()) };
    const persistence = {
      findLatest: vi.fn().mockResolvedValue({ id: "rca_1" }),
      list: vi.fn(),
      persist: vi.fn().mockResolvedValue(persisted),
    };
    const orchestrator = {
      describe: vi.fn().mockResolvedValue({
        source: "byok" as const,
        provider: "groq",
        model: "openai/gpt-oss-120b",
      }),
      analyze: vi.fn().mockResolvedValue({
        analysis: analysis(),
        usage: { requestDurationMs: 12, retries: 0 },
        promptVersion: "v2",
        credential: credential(),
      }),
    };
    const governance = {
      recordSuccess: vi.fn().mockResolvedValue(undefined),
      recordFailure: vi.fn().mockResolvedValue(undefined),
    };
    const service = new RcaApiService(
      repository,
      orchestrator,
      persistence,
      governance,
      billingStub(),
    );

    await expect(
      service.generate("org_1", "project_1", "finding_1", true),
    ).resolves.toEqual(persisted);
    expect(orchestrator.analyze).toHaveBeenCalledWith(
      "org_1",
      "project_1",
      expect.objectContaining({ serviceName: "checkout-api" }),
    );
    expect(persistence.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_1",
        projectId: "project_1",
        findingId: "finding_1",
        provider: "groq",
        model: "openai/gpt-oss-120b",
        promptVersion: "v2",
        credentialSource: "byok",
        usage: expect.any(Object),
      }),
    );
    expect(governance.recordSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_1",
        projectId: "project_1",
        findingId: "finding_1",
        provider: "groq",
        model: "openai/gpt-oss-120b",
        promptVersion: "v2",
        credentialSource: "byok",
        credentialId: "aicredential_1",
        requestDurationMs: 12,
        retries: 0,
      }),
    );
    expect(governance.recordSuccess.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ id: expect.any(String) }),
    );
    expect(governance.recordFailure).not.toHaveBeenCalled();
  });

  it("records a failed RCA invocation without leaking provider response data", async () => {
    const h = harness();
    h.orchestrator.analyze.mockRejectedValue(
      new Error("Provider request failed: secret-response-body"),
    );

    await expect(
      h.service.generate("org_1", "project_1", "finding_1", true),
    ).rejects.toThrow("Provider request failed: secret-response-body");
    expect(h.governance.recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_1",
        projectId: "project_1",
        findingId: "finding_1",
        provider: "unknown",
        model: "unknown",
        credentialSource: null,
        credentialId: null,
        errorCode: "Error",
      }),
    );
    expect(h.governance.recordFailure.mock.calls[0]?.[0]).not.toHaveProperty(
      "errorMessage",
    );
    expect(h.governance.recordFailure.mock.calls[0]?.[0]).not.toHaveProperty(
      "responseBody",
    );
  });

  it("rejects a non-bottleneck finding for RCA generation", async () => {
    const repository = {
      findFinding: vi.fn().mockResolvedValue(finding({ type: "latency" })),
    };
    const persistence = {
      findLatest: vi.fn(),
      list: vi.fn(),
      persist: vi.fn(),
    };
    const orchestrator = { analyze: vi.fn(), describe: vi.fn() };
    const governance = { recordSuccess: vi.fn(), recordFailure: vi.fn() };
    const service = new RcaApiService(
      repository,
      orchestrator,
      persistence,
      governance,
      billingStub(),
    );

    await expect(
      service.generate("org_1", "project_1", "finding_1", true),
    ).rejects.toThrow("Finding does not contain an RCA-supported bottleneck");
    expect(governance.recordFailure).not.toHaveBeenCalled();
  });

  it("preserves tenant isolation on reads", async () => {
    const repository = { findFinding: vi.fn().mockResolvedValue(finding()) };
    const persistence = {
      findLatest: vi.fn().mockResolvedValue({ id: "rca_1" }),
      list: vi.fn().mockResolvedValue([{ id: "rca_1" }]),
      persist: vi.fn(),
    };
    const service = new RcaApiService(
      repository,
      { analyze: vi.fn(), describe: vi.fn() },
      persistence,
      { recordSuccess: vi.fn(), recordFailure: vi.fn() },
      billingStub(),
    );

    await service.getLatest("org_1", "project_1", "finding_1");
    await service.getHistory("org_1", "project_1", "finding_1");

    expect(repository.findFinding).toHaveBeenNthCalledWith(
      1,
      "org_1",
      "project_1",
      "finding_1",
    );
    expect(repository.findFinding).toHaveBeenNthCalledWith(
      2,
      "org_1",
      "project_1",
      "finding_1",
    );
    expect(persistence.findLatest).toHaveBeenCalledWith(
      "org_1",
      "project_1",
      "finding_1",
    );
    expect(persistence.list).toHaveBeenCalledWith(
      "org_1",
      "project_1",
      "finding_1",
    );
  });

  it("meters a BYOK run as informational usage that cannot exhaust the allowance", async () => {
    const h = harness({ usage: { totalTokens: 1200 } });

    await h.service.generate("org_1", "project_1", "finding_1", true);

    const invocationId = String(
      h.governance.recordSuccess.mock.calls[0]?.[0].id,
    );
    expect(h.billing.assertQuota).not.toHaveBeenCalled();
    expect(h.billing.recordUsage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orgId: "org_1",
        projectId: "project_1",
        metric: "ai_tokens_byok",
        quantity: 1200,
        idempotencyKey: `${invocationId}:tokens`,
        enforce: false,
      }),
    );
    expect(h.billing.recordUsage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        metric: "rca_invocations",
        quantity: 1,
        idempotencyKey: invocationId,
        enforce: true,
      }),
    );
  });

  it("meters platform tokens under the metric the allowance is enforced on", async () => {
    const h = harness({
      usage: { totalTokens: 1200 },
      credential: credential({ source: "platform", credentialId: null }),
    });

    await h.service.generate("org_1", "project_1", "finding_1", true);

    expect(h.billing.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: "ai_tokens",
        quantity: 1200,
        enforce: true,
      }),
    );
  });

  it("skips the token event when the provider reports no usage", async () => {
    const h = harness();

    await h.service.generate("org_1", "project_1", "finding_1", true);

    expect(h.billing.recordUsage).toHaveBeenCalledOnce();
    expect(h.billing.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: "rca_invocations",
        metadata: { tokensUnreported: true },
      }),
    );
  });

  it("refuses a platform run over quota before any tokens are spent", async () => {
    vi.stubEnv("SOONWHY_AI_QUOTA_ENFORCED", "true");
    const h = harness({
      credential: credential({ source: "platform", credentialId: null }),
    });
    h.billing.assertQuota.mockRejectedValue(
      new QuotaExceededError("ai_tokens"),
    );

    await expect(
      h.service.generate("org_1", "project_1", "finding_1", true),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: "AI_QUOTA_EXCEEDED",
      });
      return true;
    });
    expect(h.orchestrator.analyze).not.toHaveBeenCalled();
    expect(h.persistence.persist).not.toHaveBeenCalled();
    expect(h.governance.recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "AI_QUOTA_EXCEEDED" }),
    );
  });

  it("leaves a BYOK run outside the enforced allowance", async () => {
    vi.stubEnv("SOONWHY_AI_QUOTA_ENFORCED", "true");
    const h = harness();

    await h.service.generate("org_1", "project_1", "finding_1", true);

    expect(h.billing.assertQuota).not.toHaveBeenCalled();
    expect(h.orchestrator.analyze).toHaveBeenCalledOnce();
  });

  it("keeps the analysis and warns when spend overruns the allowance", async () => {
    const h = harness({ usage: { totalTokens: 1200 } });
    h.billing.recordUsage.mockRejectedValue(
      new QuotaExceededError("ai_tokens"),
    );

    await expect(
      h.service.generate("org_1", "project_1", "finding_1", true),
    ).resolves.toEqual({ id: "rca_2", quotaWarning: true });
  });

  it("records usage for a spent run when billing itself is unavailable", async () => {
    const h = harness();
    h.billing.recordUsage.mockRejectedValue(new Error("billing down"));

    await expect(
      h.service.generate("org_1", "project_1", "finding_1", true),
    ).resolves.toEqual({ id: "rca_2" });
    expect(h.governance.recordFailure).not.toHaveBeenCalled();
  });
});
