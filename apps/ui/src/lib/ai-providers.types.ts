export interface AiCredential {
  id: string;
  name: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  keyHint: string;
  isDefault: boolean;
  verifiedAt: string | null;
  lastErrorCode: string | null;
}

export interface AiCredentialList {
  credentials: AiCredential[];
  canManage: boolean;
}

export interface CatalogProvider {
  id: string;
  label: string;
  baseUrl: string | null;
}

export interface LiveModels {
  source: "live" | "catalog";
  models: string[];
}

export interface ProviderFormValues {
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  isDefault: boolean;
}
