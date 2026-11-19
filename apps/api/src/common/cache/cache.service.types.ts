export interface CacheHealth {
  status: "ok" | "unavailable";
  latencyMs: number;
  error?: string;
}
