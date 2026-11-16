export type AnalysisLookup = "loading" | "found" | "missing" | "failed";

interface LookupInput {
  findingId: string | null;
  isLoading: boolean;
  isError: boolean;
  data: unknown;
  status?: number;
}

export function analysisLookup(input: LookupInput): AnalysisLookup {
  if (!input.findingId) return "missing";
  if (input.isLoading) return "loading";
  if (input.data) return "found";
  if (input.isError) return input.status === 404 ? "missing" : "failed";
  return "missing";
}

export function shouldAutoAnalyze(
  lookup: AnalysisLookup,
  startedFor: string | null,
  fingerprint: string,
): boolean {
  return lookup === "missing" && startedFor !== fingerprint;
}
