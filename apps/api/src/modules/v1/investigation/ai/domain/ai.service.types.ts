export interface AiCredentialDraft {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string | null;
}

export interface AiCredentialInput extends AiCredentialDraft {
  name?: string;
  isDefault?: boolean;
}

export interface AiCredentialPatchInput {
  name?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string | null;
  isDefault?: boolean;
}

export interface LiveModelsInput {
  credentialId?: string;
  provider?: string;
  apiKey?: string;
  baseUrl?: string | null;
}

export type AiConnectionCode =
  | "verified"
  | "invalid_key"
  | "rate_limited"
  | "unreachable"
  | "no_http_endpoint";

export interface AiConnectionResult {
  readonly ok: boolean;
  readonly checkable: boolean;
  readonly code: AiConnectionCode;
  readonly detail: string;
  readonly checkedAt: Date;
}
