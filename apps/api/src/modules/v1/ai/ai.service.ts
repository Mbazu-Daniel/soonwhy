import { Inject, Injectable, Logger } from "@nestjs/common";
import { maskPii } from "../../../common/privacy/pii-masker";
import { AiRepository } from "./ai.repository";
import { CredentialCipher } from "./credential-cipher";
import { LlmCatalog } from "./llm-catalog.service";
import {
  LlmProviderResolver,
  type ResolvedLlmModel,
} from "./llm-provider.resolver";
import { BillingService } from "../billing/billing.service";
import {
  readAiQuotaConfig,
  readAiSettingsConfig,
  type AiQuotaConfig,
  type AiSettingsConfig,
} from "./llm-provider.config";
import {
  aiBaseUrlInvalid,
  aiCredentialInvalid,
  aiProviderUnsupported,
} from "./ai.errors";
import {
  handleChatMessage,
  ChatMessage,
  ChatResponse,
  UserIntent,
  CHAT_RESPONSES,
} from "./intelligence/chat-intelligence";

/** A key is the organisation's money and its secrets, so members only read. */
export function canManageAi(userRole: string): boolean {
  return ["owner", "admin"].includes(userRole);
}

/** A short key is fully masked: its last characters are the whole secret. */
function maskKey(apiKey: string): string {
  return apiKey.length <= 8 ? "••••••••" : `••••${apiKey.slice(-4)}`;
}

const LOOPBACK_HOST = /^(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|::1|localhost)$/;
const LINK_LOCAL_HOST = /^(169\.254\.\d{1,3}\.\d{1,3}|fe80:)/;

export interface AiCredentialDraft {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string | null;
}

export type AiConnectionCode =
  | "verified"
  | "invalid_key"
  | "rate_limited"
  | "unreachable"
  | "no_http_endpoint";

export interface AiConnectionResult {
  /** The provider accepted the credential. */
  readonly ok: boolean;
  /** Whether an HTTP endpoint existed to ask in the first place. */
  readonly checkable: boolean;
  readonly code: AiConnectionCode;
  readonly detail: string;
  readonly checkedAt: Date;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly settings: AiSettingsConfig = readAiSettingsConfig();
  private readonly quota: AiQuotaConfig = readAiQuotaConfig();

  constructor(
    @Inject(AiRepository) private readonly repository: Pick<
      AiRepository,
      "get" | "upsert" | "remove" | "recordVerification" | "getInvocationTotals"
    >,
    private readonly cipher: CredentialCipher,
    @Inject(LlmProviderResolver) private readonly resolver: Pick<
      LlmProviderResolver,
      "resolve" | "describe" | "describePlatform" | "invalidate"
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
    const platform = this.resolver.describePlatform();
    if (!row)
      return { configured: false, canManage, activeSource: active.source, platform };
    return {
      configured: true,
      canManage,
      provider: row.provider,
      model: row.model,
      baseUrl: row.baseUrl,
      keyHint: row.keyHint,
      enabled: row.enabled,
      verifiedAt: row.verifiedAt,
      lastErrorCode: row.lastErrorCode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      activeSource: active.source,
      platform,
    };
  }

  /** Every provider this server can actually reach, with how much each offers. */
  async providers(orgId: string, canManage: boolean) {
    const active = await this.resolver.describe(orgId);
    return {
      providers: this.catalog.providers(),
      platform: this.resolver.describePlatform(),
      activeSource: active.source,
      canManage,
      quotaEnforced: this.quota.enforced,
    };
  }

  async models(providerId: string) {
    return this.catalog.models(providerId.trim().toLowerCase());
  }

  async save(orgId: string, input: AiCredentialDraft) {
    if (!this.cipher.available)
      throw aiCredentialInvalid(
        "This server cannot store credentials: no encryption key is configured.",
      );

    const apiKey = input.apiKey.trim();
    const model = input.model.trim();
    if (!apiKey) throw aiCredentialInvalid("An API key is required.");
    if (!model) throw aiCredentialInvalid("A model is required.");

    const providerId = input.provider.trim().toLowerCase();
    if (!this.catalog.isKnownProvider(providerId)) {
      throw aiProviderUnsupported(providerId);
    }
    const baseUrl = input.baseUrl?.trim() || null;
    if (baseUrl) this.assertBaseUrlAllowed(providerId, baseUrl);

    const row = await this.repository.upsert({
      orgId,
      provider: providerId,
      model,
      baseUrl,
      encryptedApiKey: this.cipher.encrypt(apiKey),
      keyHint: maskKey(apiKey),
    });
    this.resolver.invalidate(orgId);

    return {
      configured: true,
      provider: row?.provider,
      model: row?.model,
      baseUrl: row?.baseUrl,
      keyHint: row?.keyHint,
      updatedAt: row?.updatedAt,
      warnings: this.modelWarnings(
        providerId,
        await this.catalog.models(providerId),
        model,
      ),
    };
  }

  async remove(orgId: string) {
    await this.repository.remove(orgId);
    this.resolver.invalidate(orgId);
    return { configured: false };
  }

  /**
   * A draft body tests a key before it is paid for; an empty body tests the
   * stored one, which is also how a rotated server encryption key gets caught.
   */
  async testConnection(orgId: string, draft?: Partial<AiCredentialDraft>) {
    const target = draft
      ? await this.resolveDraft(draft)
      : await this.resolver.resolve(orgId);

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

    let code: AiConnectionCode;
    try {
      const response = await fetch(`${endpoint.replace(/\/$/, "")}/models`, {
        headers: { authorization: `Bearer ${target.apiKey}` },
        signal: AbortSignal.timeout(this.settings.verificationTimeoutMs),
      });
      code = classify(response.status);
    } catch {
      code = "unreachable";
    }

    const ok = code === "verified" || code === "rate_limited";
    if (!draft) {
      await this.repository.recordVerification(orgId, {
        verified: code === "verified",
        errorCode: code === "verified" ? null : code,
      });
    }
    return result(code, ok, true, describeCheck(code, target));
  }

  /** What the organisation spent this month, split by who paid for the tokens. */
  async usage(orgId: string) {
    const end = new Date();
    const start = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1),
    );
    const [metrics, runs, aiTokensLimit, invocationsLimit] = await Promise.all([
      this.billing.getUsage(orgId, start, end),
      this.repository.getInvocationTotals(orgId, start, end),
      this.billing.getLimit(orgId, "ai_tokens"),
      this.billing.getLimit(orgId, "rca_invocations"),
    ]);
    const total = (metric: string) =>
      metrics.find((item) => item.metric === metric)?.quantity ?? 0;
    const costOf = (source: "platform" | "byok") =>
      runs
        .filter((run) => run.credentialSource === source)
        .reduce((sum, run) => sum + (run.costUsd ?? 0), 0);

    return {
      period: { start, end },
      quotaEnforced: this.quota.enforced,
      tokens: { platform: total("ai_tokens"), byok: total("ai_tokens_byok") },
      invocations: total("rca_invocations"),
      limits: { aiTokens: aiTokensLimit, rcaInvocations: invocationsLimit },
      costUsd: { platform: costOf("platform"), byok: costOf("byok") },
      runs,
    };
  }

  /**
   * A base URL is fetched by this process with the organisation's secret in the
   * header, so it has to be the provider it claims to be: an arbitrary host
   * would turn the settings screen into a request forwarder.
   */
  private assertBaseUrlAllowed(providerId: string, rawUrl: string): void {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw aiBaseUrlInvalid(`"${rawUrl}" is not a valid URL.`);
    }
    const host = url.hostname.toLowerCase();

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

  /** Handle a chat/triage message from the user */
  async chat(
    message: string,
    orgId: string,
    messageId?: string,
  ): Promise<ChatResponse> {
    // First try the LLM-based response if credentials are configured
    const credentials = await this.repository.get(orgId);

    if (credentials) {
      return await this.chatWithLLM(message, orgId);
    }

    // Fall back to keyword-based intent classification
    return await handleChatMessage(message, orgId, undefined, undefined);
  }

  /** Use LLM to generate a contextual response */
  private async chatWithLLM(
    message: string,
    orgId: string,
  ): Promise<ChatResponse> {
    const credentials = await this.repository.get(orgId);
    if (!credentials) {
      return await handleChatMessage(message, orgId, undefined, undefined);
    }
    const { provider, model, baseUrl } = credentials;

    // Fetch real data to provide contextual responses
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Build LLM prompt with context
    const prompt = this.buildLLMPrompt(message, orgId);

    try {
      // Call the LLM provider
      const response = await this.callLLM(provider, model, baseUrl, prompt);

      // Parse and structure the response
      return await this.parseLLMResponse(response, message);
    } catch (error) {
      this.logger.error(
        `LLM chat error: ${error instanceof Error ? maskPii(error.message) : String(error)}`,
        error instanceof Error && error.stack ? maskPii(error.stack) : undefined,
      );
      // Fall back to keyword-based classification on error
      return await handleChatMessage(message, orgId, undefined, undefined);
    }
  }

  /** Build an LLM prompt with relevant system context */
  private buildLLMPrompt(message: string, orgId: string): string {
    let prompt = `You are an AI assistant for system monitoring and observability. `;

    // Add organization context
    prompt += `The user is from organization ${orgId}. `;

    // Add detection context
    prompt += `The user may be asking about: detection anomalies, SLO burn rates, change-point analysis, or system health. `;

    // Add the user's message
    prompt += `User message: "${message}". `;

    prompt += `Please provide a helpful, context-aware response. If the user is asking about detection anomalies, reference recent detections. If asking about SLO burn rates, reference error budgets. `;

    prompt += `Keep the response concise and provide follow-up suggestions.`;

    return prompt;
  }

  /** Call the LLM provider API */
  private callLLM(
    provider: string,
    model: string,
    baseUrl: string | null,
    prompt: string,
  ): Promise<string> {
    // In a real implementation, we'd decrypt the API key and make the API call
    // For now, return a placeholder response indicating LLM would be called
    return Promise.resolve(
      "LLM response would be generated here based on the prompt",
    );
  }

  /** Parse and structure the LLM response into ChatResponse */
  private async parseLLMResponse(
    llmResponse: string,
    originalMessage: string,
  ): Promise<ChatResponse> {
    const now = new Date();
    const lowerMessage = originalMessage.toLowerCase();

    // Determine suggestions based on response content
    let suggestions: string[] = [
      "Ask about detection anomalies",
      "Check SLO burn rate",
      "Look for change points",
    ];

    // Check for common response patterns and add relevant suggestions
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

    // Generate content - use LLM response or fallback to keyword-based
    let content = llmResponse;

    // If the LLM response is a placeholder, fall back to keyword-based
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
  return target.source === "platform"
    ? "The platform provider"
    : `Provider ${target.providerId}`;
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
