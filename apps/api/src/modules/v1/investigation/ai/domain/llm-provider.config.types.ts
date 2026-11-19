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

export interface AiQuotaConfig {
  readonly enforced: boolean;
  readonly tokenReserve: number;
}

export interface AiSettingsConfig {
  readonly verificationTimeoutMs: number;
  readonly allowedBaseHosts: string[];
  readonly allowInsecureBaseUrls: boolean;
}
