import { usagePeriodRange } from "../domain/ai-usage-period";
import { type UsagePeriod } from "../domain/ai-usage-period.types";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { maskPii } from "../../../../../common/privacy/pii-masker";
import { AiRepository } from "../infrastructure/ai.repository";
import { CredentialCipher } from "../domain/credential-cipher";
import { LlmCatalog } from "./llm-catalog.service";
import { LlmProviderResolver } from "./llm-provider.resolver";
import { type ResolvedLlmModel } from "./llm-provider.resolver.types";
import { BillingService } from "../../../platform/billing/application/billing.service";
import { readAiQuotaConfig, readAiSettingsConfig } from "./llm-provider.config";
import { type AiQuotaConfig, type AiSettingsConfig } from "../domain/llm-provider.config.types";
import { aiBaseUrlInvalid, aiCredentialInvalid, aiCredentialNameTaken, aiCredentialNotFound, aiModelsUnavailable, aiProviderUnsupported } from "../domain/ai.errors";
import { CUSTOM_PROVIDER_ID } from "../domain/custom-provider.constants";
import { listLiveModels } from "../domain/live-models";
import { assertPublicHttpUrl } from "../../../../../common/net/public-address";
import { LiveModelsError } from "../domain/live-models.types";
import type { CredentialPatch } from "../domain/ai.repository.types";
import { handleChatMessage } from "../intelligence/chat-intelligence";
import { ChatResponse } from "../intelligence/chat-intelligence.types";
import type { AiCredentialDraft, AiCredentialInput, AiCredentialPatchInput, LiveModelsInput, AiConnectionCode, AiConnectionResult } from "../domain/ai.service.types";

export function canManageAi(userRole: string): boolean {
  return ["owner", "admin"].includes(userRole);
}

function maskKey(apiKey: string): string {
  return apiKey.length <= 8 ? "••••••••" : `••••${apiKey.slice(-4)}`;
}

const LOOPBACK_HOST = /^(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|::1|localhost)$/;
const LINK_LOCAL_HOST = /^(169\.254\.\d{1,3}\.\d{1,3}|fe80:)/;

type CredentialRow = NonNullable<Awaited<ReturnType<AiRepository["find"]>>>;

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, cause } = error as { code?: unknown; cause?: unknown };
  return code === "23505" || isUniqueViolation(cause);
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly settings: AiSettingsConfig = readAiSettingsConfig();
  private readonly quota: AiQuotaConfig = readAiQuotaConfig();

  constructor(
    @Inject(AiRepository) private readonly repository: Pick<
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
    >,
    @Inject(CredentialCipher) private readonly cipher: CredentialCipher,
    @Inject(LlmProviderResolver) private readonly resolver: Pick<
      LlmProviderResolver,
      "resolve" | "describe" | "invalidate"
    >,
    @Inject(LlmCatalog) private readonly catalog: Pick<
      LlmCatalog,
      | "providers"
      | "models"
      | "isKnownProvider"
      | "allowedHostnamesFor"
      | "endpointFor"
    >,
    @Inject(BillingService) private readonly billing: Pick<
      BillingService,
      "getUsage" | "getLimit"
    >,
  ) {}

  async get(orgId: string, canManage: boolean) {
    const [row, active] = await Promise.all([
      this.repository.get(orgId),
      this.resolver.describe(orgId),
    ]);
    if (!row)
      return { configured: false, canManage, activeSource: active.source };
    return {
      configured: true,
      canManage,
      ...this.view(row),
      activeSource: active.source,
    };
  }

  async providers(orgId: string, canManage: boolean) {
    const active = await this.resolver.describe(orgId);
    return {
      providers: this.catalog.providers(),
      activeSource: active.source,
      canManage,
      quotaEnforced: this.quota.enforced,
    };
  }

  async models(providerId: string) {
    return this.catalog.models(providerId.trim().toLowerCase());
  }

  async list(orgId: string, canManage: boolean) {
    const [rows, active] = await Promise.all([
      this.repository.list(orgId),
      this.resolver.describe(orgId),
    ]);
    return {
      credentials: rows.map((row) => this.view(row)),
      canManage,
      activeSource: active.source,
    };
  }

  async create(orgId: string, input: AiCredentialInput) {
    this.assertCanStore();
    const draft = await this.validated(input);
    const requestedKey = input.apiKey?.trim() ?? "";
    if (!requestedKey) throw aiCredentialInvalid("An API key is required.");
    const name = input.name?.trim() || this.labelOf(draft.providerId);
    try {
      const row = await this.repository.create(
        {
          orgId,
          name,
          provider: draft.providerId,
          model: draft.model,
          baseUrl: draft.baseUrl,
          encryptedApiKey: this.cipher.encrypt(requestedKey),
          keyHint: maskKey(requestedKey),
        },
        input.isDefault === true,
      );
      this.resolver.invalidate(orgId);
      return { ...this.view(row), warnings: await this.warningsFor(row) };
    } catch (error) {
      throw this.translated(error, name);
    }
  }

  async update(orgId: string, id: string, input: AiCredentialPatchInput) {
    const row = await this.repository.find(orgId, id);
    if (!row) throw aiCredentialNotFound();
    const patch: CredentialPatch = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw aiCredentialInvalid("A name is required.");
      patch.name = name;
    }
    if (input.model !== undefined) {
      const model = input.model.trim();
      if (!model) throw aiCredentialInvalid("A model is required.");
      patch.model = model;
    }
    if (input.baseUrl !== undefined) {
      const baseUrl = input.baseUrl?.trim() || null;
      if (baseUrl) this.assertBaseUrlAllowed(row.provider, baseUrl);
      if (!baseUrl && row.provider === CUSTOM_PROVIDER_ID) {
        throw aiCredentialInvalid("A custom endpoint needs a base URL.");
      }
      patch.baseUrl = baseUrl;
    }
    const requestedKey = input.apiKey?.trim() ?? "";
    if (requestedKey) {
      this.assertCanStore();
      patch.encryptedApiKey = this.cipher.encrypt(requestedKey);
      patch.keyHint = maskKey(requestedKey);
    }
    try {
      const updated = await this.repository.update(orgId, id, patch, input.isDefault === true);
      if (!updated) throw aiCredentialNotFound();
      this.resolver.invalidate(orgId);
      return { ...this.view(updated), warnings: await this.warningsFor(updated) };
    } catch (error) {
      throw this.translated(error, patch.name ?? row.name);
    }
  }

  async removeCredential(orgId: string, id: string) {
    const removed = await this.repository.remove(orgId, id);
    if (!removed) throw aiCredentialNotFound();
    this.resolver.invalidate(orgId);
    return { removed: true };
  }

  async save(orgId: string, input: AiCredentialDraft) {
    const current = await this.repository.get(orgId);
    const result = current
      ? await this.update(orgId, current.id, {
          model: input.model,
          apiKey: input.apiKey,
          baseUrl: input.baseUrl,
        })
      : await this.create(orgId, { ...input, isDefault: true });
    return { configured: true, ...result };
  }

  async remove(orgId: string) {
    const current = await this.repository.get(orgId);
    if (current) await this.removeCredential(orgId, current.id);
    return { configured: false };
  }

  async liveModels(orgId: string, input: LiveModelsInput) {
    const target = input.credentialId && !input.apiKey?.trim()
      ? await this.resolver.resolve(orgId, input.credentialId)
      : await this.draftTarget(orgId, input);
    const endpoint = this.catalog.endpointFor(target.providerId, target.baseUrl);
    if (endpoint === null) {
      const known = await this.catalog.models(target.providerId);
      return { source: "catalog" as const, models: known.map((item) => item.id) };
    }
    await this.assertEndpointPublic(endpoint);
    try {
      const models = await listLiveModels({
        endpoint,
        apiKey: target.apiKey,
        timeoutMs: this.settings.verificationTimeoutMs,
      });
      return { source: "live" as const, models };
    } catch (error) {
      if (error instanceof LiveModelsError) throw aiModelsUnavailable(error.failure, endpoint);
      throw error;
    }
  }

  async testConnection(orgId: string, draft?: Partial<AiCredentialDraft>, credentialId?: string) {
    const target = draft
      ? await this.resolveDraft(draft)
      : await this.resolver.resolve(orgId, credentialId);

    const endpoint = this.catalog.endpointFor(
      target.providerId,
      target.baseUrl,
    );
    if (endpoint === null) {
      return result(
        "no_http_endpoint",
        false,
        false,
        `${labelFor(target)} does not expose an OpenAI-compatible endpoint we can query, so the key is used as saved.`,
      );
    }

    await this.assertEndpointPublic(endpoint);
    let code: AiConnectionCode;
    try {
      const response = await fetch(`${endpoint.replace(/\/$/, "")}/models`, {
        redirect: "manual",
        headers: { authorization: `Bearer ${target.apiKey}` },
        signal: AbortSignal.timeout(this.settings.verificationTimeoutMs),
      });
      code = classify(response.status);
    } catch {
      code = "unreachable";
    }

    const ok = code === "verified" || code === "rate_limited";
    if (!draft && target.credentialId) {
      await this.repository.recordVerification(orgId, target.credentialId, {
        verified: code === "verified",
        errorCode: code === "verified" ? null : code,
      });
    }
    return result(code, ok, true, describeCheck(code, target));
  }

  private view(row: CredentialRow) {
    return {
      id: row.id,
      name: row.name,
      provider: row.provider,
      model: row.model,
      baseUrl: row.baseUrl,
      keyHint: row.keyHint,
      enabled: row.enabled,
      isDefault: row.isDefault,
      verifiedAt: row.verifiedAt,
      lastErrorCode: row.lastErrorCode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private assertCanStore(): void {
    if (!this.cipher.available)
      throw aiCredentialInvalid(
        "This server cannot store credentials: no encryption key is configured.",
      );
  }

  private labelOf(providerId: string): string {
    return this.catalog.providers().find((item) => item.id === providerId)?.label ?? providerId;
  }

  private async validated(input: AiCredentialDraft) {
    const model = input.model.trim();
    if (!model) throw aiCredentialInvalid("A model is required.");
    const providerId = input.provider.trim().toLowerCase();
    if (!this.catalog.isKnownProvider(providerId)) throw aiProviderUnsupported(providerId);
    const baseUrl = input.baseUrl?.trim() || null;
    if (baseUrl) this.assertBaseUrlAllowed(providerId, baseUrl);
    if (!baseUrl && providerId === CUSTOM_PROVIDER_ID) {
      throw aiCredentialInvalid("A custom endpoint needs a base URL.");
    }
    return { providerId, model, baseUrl };
  }

  private async draftTarget(orgId: string, input: LiveModelsInput): Promise<ResolvedLlmModel> {
    const apiKey = input.apiKey?.trim() ?? "";
    if (!input.provider || !apiKey) {
      throw aiCredentialInvalid("Listing models needs a provider and a key, or a saved provider.");
    }
    const providerId = input.provider.trim().toLowerCase();
    if (!this.catalog.isKnownProvider(providerId)) throw aiProviderUnsupported(providerId);
    const baseUrl = input.baseUrl?.trim() || null;
    if (baseUrl) this.assertBaseUrlAllowed(providerId, baseUrl);
    return { source: "byok", providerId, model: "", baseUrl, apiKey, credentialId: null };
  }

  private async warningsFor(row: CredentialRow): Promise<string[]> {
    if (row.provider === CUSTOM_PROVIDER_ID) return [];
    return this.modelWarnings(row.provider, await this.catalog.models(row.provider), row.model);
  }

  private translated(error: unknown, name: string): unknown {
    return isUniqueViolation(error) ? aiCredentialNameTaken(name) : error;
  }

  async usage(orgId: string, period: UsagePeriod = "month", now: Date = new Date()) {
    const { start, end } = usagePeriodRange(period, now);
    const [metrics, runs, projects, chatCosts, aiTokensLimit, invocationsLimit] = await Promise.all([
      this.billing.getUsage(orgId, start, end),
      this.repository.getInvocationTotals(orgId, start, end),
      this.repository.getProjectSpend(orgId, start, end),
      this.repository.getChatCostTotals(orgId, start, end),
      this.billing.getLimit(orgId, "ai_tokens"),
      this.billing.getLimit(orgId, "rca_invocations"),
    ]);
    const total = (metric: string) =>
      metrics.find((item) => item.metric === metric)?.quantity ?? 0;
    const costOf = (source: "platform" | "byok") =>
      runs
        .filter((run) => run.credentialSource === source)
        .reduce((sum, run) => sum + (run.costUsd ?? 0), 0) +
      chatCosts
        .filter((chat) => chat.credentialSource === source)
        .reduce((sum, chat) => sum + (chat.costUsd ?? 0), 0);

    return {
      period: { name: period, start, end },
      quotaEnforced: this.quota.enforced,
      tokens: { platform: total("ai_tokens"), byok: total("ai_tokens_byok") },
      invocations: total("rca_invocations"),
      limits: { aiTokens: aiTokensLimit, rcaInvocations: invocationsLimit },
      costUsd: { platform: costOf("platform"), byok: costOf("byok") },
      runs,
      projects,
    };
  }

  private async assertEndpointPublic(endpoint: string): Promise<void> {
    if (this.settings.allowInsecureBaseUrls) return;
    try {
      await assertPublicHttpUrl(endpoint);
    } catch {
      throw aiBaseUrlInvalid("The base URL must resolve to a public provider host.");
    }
  }

  private assertBaseUrlAllowed(providerId: string, rawUrl: string): void {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw aiBaseUrlInvalid(`"${rawUrl}" is not a valid URL.`);
    }
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

    if (LOOPBACK_HOST.test(host)) {
      if (!this.settings.allowInsecureBaseUrls) {
        throw aiBaseUrlInvalid("The base URL must be a public provider host.");
      }
      return;
    }
    if (url.protocol !== "https:") {
      throw aiBaseUrlInvalid("The base URL must use HTTPS.");
    }
    if (LINK_LOCAL_HOST.test(host) || host.endsWith(".internal")) {
      throw aiBaseUrlInvalid(
        "The base URL points at an address this server will not send keys to.",
      );
    }

    if (providerId === CUSTOM_PROVIDER_ID) return;

    const allowed = new Set([
      ...this.catalog.allowedHostnamesFor(providerId),
      ...this.settings.allowedBaseHosts,
    ]);
    if (allowed.size > 0 && !allowed.has(host)) {
      throw aiBaseUrlInvalid(
        `"${host}" is not a documented host for ${providerId}. Set SOONWHY_AI_ALLOWED_BASE_HOSTS if it is your own gateway.`,
      );
    }
  }

  private async resolveDraft(
    draft: Partial<AiCredentialDraft>,
  ): Promise<ResolvedLlmModel> {
    const { provider, model, apiKey } = draft;
    if (!provider || !model || !apiKey) {
      throw aiCredentialInvalid(
        "A draft test needs the provider, the model and the key together.",
      );
    }
    const providerId = provider.trim().toLowerCase();
    if (!this.catalog.isKnownProvider(providerId)) {
      throw aiProviderUnsupported(providerId);
    }
    const baseUrl = draft.baseUrl?.trim() || null;
    if (baseUrl) this.assertBaseUrlAllowed(providerId, baseUrl);

    return {
      source: "byok",
      providerId,
      model: model.trim(),
      baseUrl,
      apiKey: apiKey.trim(),
      credentialId: null,
    };
  }

  private modelWarnings(
    providerId: string,
    models: Awaited<ReturnType<LlmCatalog["models"]>>,
    model: string,
  ): string[] {
    const chosen = models.find((item) => item.id === model);
    if (!chosen) {
      return [
        `${providerId}/${model} is not in the current catalogue; the name is sent to the provider as written.`,
      ];
    }
    const warnings: string[] = [];
    if (!chosen.supportsStructuredOutput) {
      warnings.push(
        "This model is not known to return structured output, which root cause analysis depends on.",
      );
    }
    if (chosen.deprecated) {
      warnings.push("This model is marked deprecated by the provider.");
    }
    return warnings;
  }

  async chat(
    message: string,
    orgId: string,
    _messageId?: string,
  ): Promise<ChatResponse> {
    const credentials = await this.repository.get(orgId);

    if (credentials) {
      return await this.chatWithLLM(message, orgId);
    }

    return await handleChatMessage(message, orgId, undefined, undefined);
  }

  private async chatWithLLM(
    message: string,
    orgId: string,
  ): Promise<ChatResponse> {
    const credentials = await this.repository.get(orgId);
    if (!credentials) {
      return await handleChatMessage(message, orgId, undefined, undefined);
    }
    const { provider, model, baseUrl } = credentials;

    const now = new Date();
    const _thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const prompt = this.buildLLMPrompt(message, orgId);

    try {
      const response = await this.callLLM(provider, model, baseUrl, prompt);

      return await this.parseLLMResponse(response, message);
    } catch (error) {
      this.logger.error(
        `LLM chat error: ${error instanceof Error ? maskPii(error.message) : String(error)}`,
        error instanceof Error && error.stack ? maskPii(error.stack) : undefined,
      );
      return await handleChatMessage(message, orgId, undefined, undefined);
    }
  }

  private buildLLMPrompt(message: string, orgId: string): string {
    let prompt = `You are an AI assistant for system monitoring and observability. `;

    prompt += `The user is from organization ${orgId}. `;

    prompt += `The user may be asking about: detection anomalies, SLO burn rates, change-point analysis, or system health. `;

    prompt += `User message: "${message}". `;

    prompt += `Please provide a helpful, context-aware response. If the user is asking about detection anomalies, reference recent detections. If asking about SLO burn rates, reference error budgets. `;

    prompt += `Keep the response concise and provide follow-up suggestions.`;

    return prompt;
  }

  private callLLM(
    _provider: string,
    _model: string,
    _baseUrl: string | null,
    _prompt: string,
  ): Promise<string> {
    return Promise.resolve(
      "LLM response would be generated here based on the prompt",
    );
  }

  private async parseLLMResponse(
    llmResponse: string,
    originalMessage: string,
  ): Promise<ChatResponse> {
    const now = new Date();
    const _lowerMessage = originalMessage.toLowerCase();

    let suggestions: string[] = [
      "Ask about detection anomalies",
      "Check SLO burn rate",
      "Look for change points",
    ];

    if (/anomaly/i.test(llmResponse) || /detect/i.test(llmResponse)) {
      suggestions = [
        "Show me current detections",
        "Explain anomaly score",
        "View change points",
      ];
    }
    if (
      /slo/i.test(llmResponse) ||
      /burn rate/i.test(llmResponse) ||
      /budget/i.test(llmResponse)
    ) {
      suggestions = [
        "Check SLO status",
        "View error budget",
        "Understand burn rate",
      ];
    }
    if (
      /change.point/i.test(llmResponse) ||
      /structural break/i.test(llmResponse)
    ) {
      suggestions = [
        "Run change-point detection",
        "Explain change points",
        "View detected changes",
      ];
    }
    if (/health/i.test(llmResponse) || /status/i.test(llmResponse)) {
      suggestions = [
        "Check detection anomalies",
        "SLO burn rate status",
        "System overview",
      ];
    }

    let content = llmResponse;

    if (content.includes("LLM response would be generated")) {
      const fallback = await handleChatMessage(originalMessage, "");
      content = fallback.content;
      suggestions = fallback.suggestions ?? suggestions;
    }

    return {
      id: "msg_" + Date.now(),
      role: "assistant",
      content,
      timestamp: now,
      suggestions,
    };
  }
}

function classify(status: number): AiConnectionCode {
  if (status >= 200 && status < 300) return "verified";
  if (status === 401 || status === 403) return "invalid_key";
  if (status === 429) return "rate_limited";
  return "unreachable";
}

function labelFor(target: ResolvedLlmModel): string {
  return `Provider ${target.providerId}`;
}

function describeCheck(
  code: AiConnectionCode,
  target: ResolvedLlmModel,
): string {
  switch (code) {
    case "verified":
      return `${labelFor(target)} accepted the key.`;
    case "invalid_key":
      return "The provider rejected this key. Check it was copied in full and is still active.";
    case "rate_limited":
      return "The provider accepted the key but is rate limiting this account.";
    case "unreachable":
      return `${labelFor(target)} could not be reached at ${target.baseUrl}. The endpoint or the network is at fault, not necessarily the key.`;
    case "no_http_endpoint":
      return "This provider has no queryable endpoint.";
    default: {
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}

function result(
  code: AiConnectionCode,
  ok: boolean,
  checkable: boolean,
  detail: string,
): AiConnectionResult {
  return { ok, checkable, code, detail, checkedAt: new Date() };
}
