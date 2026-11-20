export interface ProjectAiSpend {
  projectId: string;
  name: string;
  slug: string;
  runs: number;
  rcaTokens: number;
  chatTokens: number;
  chatCostUsd: number;
  costUsd: number;
}

export interface NewCredential {
  orgId: string;
  name: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  encryptedApiKey: string;
  keyHint: string;
}

export interface CredentialPatch {
  name?: string;
  model?: string;
  baseUrl?: string | null;
  encryptedApiKey?: string;
  keyHint?: string;
}
