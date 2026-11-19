export interface AiSummary {
  summary: string;
  source: "byok" | "deterministic";
  provider: string | null;
  model: string | null;
  generatedAt: string;
}
