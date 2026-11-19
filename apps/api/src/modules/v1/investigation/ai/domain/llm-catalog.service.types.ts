export interface CatalogProvider {
  id: string;
  label: string;
  baseUrl: string | null;
  docUrl: string | null;
  modelCount: number;
  rcaSafeModelCount: number | null;
}

export interface CatalogModel {
  id: string;
  label: string;
  description: string | null;
  contextTokens: number | null;
  outputTokens: number | null;
  inputCostUsdPerMillion: number | null;
  outputCostUsdPerMillion: number | null;
  supportsStructuredOutput: boolean;
  deprecated: boolean;
}

export interface ModelPricing {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}
