export interface MastraRcaProviderConfig {
  apiKey: string;
  model: string;
  providerId?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxPromptCharacters?: number;
  maxRetries?: number;
  inputCostPerMillionTokensUsd?: number;
  outputCostPerMillionTokensUsd?: number;
  promptVersion?: string;
}
