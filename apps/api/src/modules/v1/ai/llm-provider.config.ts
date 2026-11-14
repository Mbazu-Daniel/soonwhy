import type { MastraRcaProviderConfig } from "../detections/rca.provider";
import { RCA_PROMPT_VERSION } from "../detections/rca.prompt";

export interface LlmTuning {
  readonly timeoutMs?: number;
  readonly maxPromptCharacters?: number;
  readonly maxRetries?: number;
  readonly promptVersion: string;
}

export interface ModelCostRates {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

export interface LlmEndpoint {
  readonly providerId: string;
  readonly model: string;
  readonly baseUrl: string | null;
  readonly apiKey: string;
}

function positiveNumber(raw: string | undefined): number | undefined {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function nonNegativeInteger(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

export function readLlmTuning(env: NodeJS.ProcessEnv = process.env): LlmTuning {
  return {
    timeoutMs: positiveNumber(env.SOONWHY_RCA_TIMEOUT_MS),
    maxPromptCharacters: positiveNumber(env.SOONWHY_RCA_MAX_PROMPT_CHARACTERS),
    maxRetries: nonNegativeInteger(env.SOONWHY_RCA_MAX_RETRIES),
    promptVersion: env.SOONWHY_RCA_PROMPT_VERSION ?? RCA_PROMPT_VERSION,
  };
}

export interface AiQuotaConfig {
  readonly enforced: boolean;
  readonly tokenReserve: number;
}

const DEFAULT_TOKEN_RESERVE = 8_000;

export function readAiQuotaConfig(
  env: NodeJS.ProcessEnv = process.env,
): AiQuotaConfig {
  return {
    enforced: env.SOONWHY_AI_QUOTA_ENFORCED === "true",
    tokenReserve:
      positiveNumber(env.SOONWHY_AI_TOKEN_RESERVE) ?? DEFAULT_TOKEN_RESERVE,
  };
}

export interface AiSettingsConfig {
  readonly verificationTimeoutMs: number;
  readonly allowedBaseHosts: string[];
  readonly allowInsecureBaseUrls: boolean;
}

const DEFAULT_VERIFICATION_TIMEOUT_MS = 8_000;

export function readAiSettingsConfig(
  env: NodeJS.ProcessEnv = process.env,
): AiSettingsConfig {
  return {
    verificationTimeoutMs:
      positiveNumber(env.SOONWHY_AI_VERIFY_TIMEOUT_MS) ??
      DEFAULT_VERIFICATION_TIMEOUT_MS,
    allowedBaseHosts: (env.SOONWHY_AI_ALLOWED_BASE_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
    allowInsecureBaseUrls: env.NODE_ENV !== "production",
  };
}

export function buildProviderConfig(
  endpoint: LlmEndpoint,
  tuning: LlmTuning,
  cost?: ModelCostRates,
): MastraRcaProviderConfig {
  return {
    providerId: endpoint.providerId,
    model: endpoint.model,
    baseUrl: endpoint.baseUrl ?? undefined,
    apiKey: endpoint.apiKey,
    timeoutMs: tuning.timeoutMs,
    maxPromptCharacters: tuning.maxPromptCharacters,
    maxRetries: tuning.maxRetries,
    promptVersion: tuning.promptVersion,
    inputCostPerMillionTokensUsd: cost?.inputUsdPerMillion,
    outputCostPerMillionTokensUsd: cost?.outputUsdPerMillion,
  };
}
