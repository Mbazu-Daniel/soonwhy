export interface ProjectSpend {
  projectId: string;
  name: string;
  slug: string;
  runs: number;
  rcaTokens: number;
  chatTokens: number;
  costUsd: number;
}

export interface AiUsage {
  tokens: { platform: number; byok: number };
  invocations: number;
  costUsd: { platform: number; byok: number };
  projects?: ProjectSpend[];
}
